import { useMemo, useState } from "react";
import type { DragEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
    FACE_VALUES_CENTS,
    GRADES,
    findCoinTypeId,
    indexCoinTypes,
    type Grade,
} from "@mynt/core";

import { ApiError } from "@/app/lib/api";
import { catalogQueries } from "@/app/lib/catalog";
import { countryCollator, countryFlag, countryName } from "@/app/lib/countries";
import { formatFaceValue } from "@/app/lib/format";
import { Button } from "@/app/ui/button";
import { modalError, MODAL_TOASTER } from "@/app/ui/toast";
import {
    useAddCoins,
    useImportAnalyze,
    type ImportedItem,
} from "../hooks/use-collection";

const MAX_BYTES = 10 * 1024 * 1024;
const XLSX =
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
// What the server accepts. A spreadsheet is not in the list: it is turned into
// CSV here, so the server (and the AI behind it) only ever sees text.
const SERVER_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
    "application/pdf",
    "text/plain",
    "text/csv",
];
const ACCEPT = `${SERVER_TYPES.join(",")},${XLSX},.csv,.txt,.xlsx,.heic,.heif`;

/** The browser leaves the type empty for some files (HEIC, CSV on Windows), so
 *  the extension is the fallback. */
function mimeTypeOf(file: File): string | null {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (file.type === XLSX || ext === "xlsx") return XLSX;
    if (SERVER_TYPES.includes(file.type)) return file.type;
    const byExt: Record<string, string> = {
        csv: "text/csv",
        txt: "text/plain",
        heic: "image/heic",
        heif: "image/heif",
    };
    return (ext && byExt[ext]) || null;
}

function toBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () =>
            resolve(String(reader.result).split(",")[1] ?? "");
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });
}

/** First sheet only, as CSV: a collector's list is one sheet, and the library
 *  stays out of the bundle until someone actually imports a spreadsheet. */
async function xlsxToCsv(file: File): Promise<string> {
    const { readSheet } = await import("read-excel-file/browser");
    const quote = (cell: unknown) => {
        const text =
            cell instanceof Date
                ? cell.toISOString().slice(0, 10)
                : String(cell ?? "");
        return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    return (await readSheet(file))
        .map((row) => row.map(quote).join(","))
        .join("\n");
}

async function encode(file: File, mimeType: string) {
    if (mimeType !== XLSX) return { mimeType, data: await toBase64(file) };
    const csv = new Blob([await xlsxToCsv(file)], { type: "text/plain" });
    return { mimeType: "text/plain", data: await toBase64(csv) };
}

interface Row {
    key: number;
    countryCode: string;
    faceValue: string;
    year: string;
    quantity: string;
    grade: Grade | "";
    variant: string;
    note: string | null;
    checked: boolean;
}

export function ImportCoins({ onDone }: { onDone: () => void }) {
    const { t } = useTranslation();
    const analyze = useImportAnalyze();
    const addCoins = useAddCoins();
    const countries = useQuery(catalogQueries.countries());
    const coinTypes = useQuery(catalogQueries.coinTypes());

    const [file, setFile] = useState<File | null>(null);
    const [dragging, setDragging] = useState(false);
    const [rows, setRows] = useState<Row[] | null>(null);

    const index = useMemo(
        () => indexCoinTypes(coinTypes.data ?? []),
        [coinTypes.data],
    );
    const codes = useMemo(() => {
        const collator = countryCollator();
        return (countries.data ?? [])
            .map((c) => c.countryCode)
            .sort((a, b) => collator.compare(countryName(a), countryName(b)));
    }, [countries.data]);

    // The variant the AI read wins when the catalog knows it; otherwise the plain
    // coin is the best guess rather than a reason to reject the row.
    function match(row: Row): number | null {
        const year = Number(row.year);
        const faceValue = Number(row.faceValue);
        if (!row.countryCode || !faceValue || !/^\d{4}$/.test(row.year))
            return null;
        return (
            (row.variant
                ? findCoinTypeId(
                      index,
                      row.countryCode,
                      faceValue,
                      year,
                      row.variant,
                  )
                : null) ??
            findCoinTypeId(index, row.countryCode, faceValue, year)
        );
    }

    function pick(next: File | undefined) {
        if (!next) return;
        if (next.size > MAX_BYTES)
            return modalError(t("importCoins.errors.tooLarge"));
        if (!mimeTypeOf(next))
            return modalError(t("importCoins.errors.wrongType"));
        setFile(next);
    }

    function onDrop(event: DragEvent) {
        event.preventDefault();
        setDragging(false);
        pick(event.dataTransfer.files[0]);
    }

    function toRows(items: ImportedItem[]): Row[] {
        return items.map((item, i) => {
            const row: Row = {
                key: i,
                countryCode: item.countryCode?.toUpperCase() ?? "",
                faceValue:
                    item.faceValueCents === null
                        ? ""
                        : String(item.faceValueCents),
                year: item.year === null ? "" : String(item.year),
                quantity: String(Math.max(1, item.quantity || 1)),
                // Only a grade the app knows: a free-text "mint" would fail the server's
                // validation for the whole batch.
                grade: (GRADES as readonly string[]).includes(item.grade ?? "")
                    ? (item.grade as Grade)
                    : "",
                variant: item.variant ?? "",
                note: item.note,
                checked: false,
            };
            return { ...row, checked: match(row) !== null };
        });
    }

    function onAnalyze() {
        const mimeType = file && mimeTypeOf(file);
        if (!file || !mimeType) return;

        const running = encode(file, mimeType)
            .catch(() => {
                throw new Error("unreadable");
            })
            .then((payload) => analyze.mutateAsync(payload));
        toast.promise(running, {
            toasterId: MODAL_TOASTER,
            loading: t("importCoins.analyzing"),
            success: (items: ImportedItem[]) =>
                t("importCoins.found", { count: items.length }),
            error: (error: unknown) => {
                if (error instanceof ApiError) {
                    if (error.code === "import_unavailable")
                        return t("importCoins.errors.unavailable");
                    if (error.code === "analysis_failed")
                        return t("importCoins.errors.failed");
                    if (error.code === "ai_busy")
                        return t("importCoins.errors.busy");
                    if (error.code === "file_too_large")
                        return t("importCoins.errors.tooLarge");
                    if (error.status === 429)
                        return t("importCoins.errors.rateLimited");
                }
                return error instanceof Error && error.message === "unreadable"
                    ? t("importCoins.errors.unreadable")
                    : t("importCoins.errors.generic");
            },
        });
        running.then(
            (items) => setRows(toRows(items)),
            () => {},
        );
    }

    function update(key: number, patch: Partial<Row>) {
        setRows(
            (list) =>
                list?.map((r) => (r.key === key ? { ...r, ...patch } : r)) ??
                null,
        );
    }

    function restart() {
        setRows(null);
        setFile(null);
    }

    if (rows === null) {
        return (
            <div className="flex flex-col gap-5">
                <label
                    onDragOver={(e) => {
                        e.preventDefault();
                        setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={onDrop}
                    // focus-within: the real input is hidden, so the label has to show
                    // keyboard focus on its behalf.
                    className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2
                      border-dashed px-6 py-10 text-center focus-within:border-ink ${
                          dragging ? "border-ink bg-hover" : "border-field"
                      }`}
                >
                    <input
                        type="file"
                        accept={ACCEPT}
                        className="sr-only"
                        onChange={(e) => {
                            pick(e.target.files?.[0]);
                            e.target.value = "";
                        }}
                    />
                    <span className="text-base">{t("importCoins.drop")}</span>
                    <span className="text-sm text-muted">
                        {t("importCoins.types")}
                    </span>
                </label>

                <p className="text-sm text-muted">{t("importCoins.privacy")}</p>

                {file && (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <span className="min-w-0 truncate text-base">
                            {file.name}
                        </span>
                        <Button onClick={onAnalyze} loading={analyze.isPending}>
                            {t("importCoins.analyze")}
                        </Button>
                    </div>
                )}
            </div>
        );
    }

    if (rows.length === 0) {
        return (
            <div className="flex flex-col items-start gap-4">
                <p className="text-base text-muted">{t("importCoins.none")}</p>
                <Button variant="ghost" onClick={restart}>
                    {t("importCoins.restart")}
                </Button>
            </div>
        );
    }

    const selected = rows.filter((r) => r.checked && match(r) !== null);
    const total = selected.reduce(
        (sum, r) => sum + Math.max(1, Number(r.quantity) || 1),
        0,
    );

    function onSubmit() {
        const coins = selected.flatMap((r) =>
            Array.from(
                { length: Math.max(1, Number(r.quantity) || 1) },
                () => ({
                    coinTypeId: match(r) as number,
                    grade: r.grade || null,
                }),
            ),
        );
        const saving = addCoins.mutateAsync(coins);
        toast.promise(saving, {
            toasterId: MODAL_TOASTER,
            loading: t("common.saving"),
            error: t("importCoins.errors.save"),
        });
        // Success closes the modal and its toaster, so the confirmation goes to the
        // page's own, as after an edit.
        saving.then(
            () => {
                onDone();
                toast.success(t("importCoins.added", { count: coins.length }));
            },
            () => {},
        );
    }

    // Slimmer than the add form's fields: five of them share one row here.
    const field = "h-10 rounded-md border border-field bg-raised px-2 text-sm";

    return (
        <div className="flex flex-col gap-5">
            <p className="text-sm text-muted">{t("importCoins.review")}</p>

            <ul className="flex flex-col gap-3">
                {rows.map((row) => {
                    const found = match(row) !== null;
                    return (
                        <li
                            key={row.key}
                            className="flex gap-3 rounded-xl bg-card p-3"
                        >
                            <input
                                type="checkbox"
                                aria-label={t("importCoins.include")}
                                className="mt-3 size-4 shrink-0 accent-ink"
                                checked={row.checked && found}
                                disabled={!found}
                                onChange={(e) =>
                                    update(row.key, {
                                        checked: e.target.checked,
                                    })
                                }
                            />
                            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                                {/* Five columns from sm up, filling the row, the country a little wider
                    for its flag and name. On a phone the
                    country takes a full line and the rest go two by two. */}
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
                                    <select
                                        aria-label={t("quickAdd.country")}
                                        className={`${field} col-span-2 w-full min-w-0 sm:col-span-1`}
                                        value={row.countryCode}
                                        onChange={(e) =>
                                            update(row.key, {
                                                countryCode: e.target.value,
                                            })
                                        }
                                    >
                                        <option value="">
                                            {t("importCoins.countryNone")}
                                        </option>
                                        {codes.map((code) => (
                                            <option key={code} value={code}>
                                                {countryFlag(code)}{" "}
                                                {countryName(code)}
                                            </option>
                                        ))}
                                    </select>
                                    <select
                                        aria-label={t("quickAdd.faceValue")}
                                        className={`${field} w-full min-w-0`}
                                        value={row.faceValue}
                                        onChange={(e) =>
                                            update(row.key, {
                                                faceValue: e.target.value,
                                            })
                                        }
                                    >
                                        <option value="">
                                            {t("importCoins.faceValueNone")}
                                        </option>
                                        {FACE_VALUES_CENTS.map((cents) => (
                                            <option key={cents} value={cents}>
                                                {formatFaceValue(cents)}
                                            </option>
                                        ))}
                                    </select>
                                    <input
                                        aria-label={t("quickAdd.year")}
                                        inputMode="numeric"
                                        maxLength={4}
                                        placeholder="2003"
                                        className={`${field} tnum w-full min-w-0`}
                                        value={row.year}
                                        onChange={(e) =>
                                            update(row.key, {
                                                year: e.target.value.replace(
                                                    /\D/g,
                                                    "",
                                                ),
                                            })
                                        }
                                    />
                                    <input
                                        aria-label={t("importCoins.quantity")}
                                        type="number"
                                        min={1}
                                        max={500}
                                        className={`${field} tnum w-full min-w-0`}
                                        value={row.quantity}
                                        onChange={(e) =>
                                            update(row.key, {
                                                quantity: e.target.value,
                                            })
                                        }
                                    />
                                    <select
                                        aria-label={t("quickAdd.grade")}
                                        className={`${field} w-full min-w-0`}
                                        value={row.grade}
                                        onChange={(e) =>
                                            update(row.key, {
                                                grade: e.target.value as
                                                    | Grade
                                                    | "",
                                            })
                                        }
                                    >
                                        {/* The field's own name as the empty choice: "Non renseigné" does
                      not fit the narrow column. */}
                                        <option value="">
                                            {t("quickAdd.grade")}
                                        </option>
                                        {GRADES.map((g) => (
                                            <option key={g} value={g}>
                                                {t(`grade.short.${g}`)}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <p className="text-xs">
                                    <span
                                        className={
                                            found ? "text-muted" : "text-danger"
                                        }
                                    >
                                        {found
                                            ? t("importCoins.inCatalog")
                                            : t("importCoins.outOfCatalog")}
                                    </span>
                                    {row.note && (
                                        <span className="text-muted">
                                            {" "}
                                            · {row.note}
                                        </span>
                                    )}
                                </p>
                            </div>
                        </li>
                    );
                })}
            </ul>

            {/* Pinned to the bottom of the modal's scrolling body, so the submit is
          always in reach however long the list is. The negative offsets undo
          the body's px-7 / pb-6 so the bar runs edge to edge. */}
            <div className="sticky -bottom-6 -mx-7 -mb-6 flex flex-wrap items-center justify-between gap-3 border-t border-rule bg-surface px-7 py-4">
                <Button variant="ghost" onClick={restart}>
                    {t("importCoins.restart")}
                </Button>
                <Button
                    disabled={total === 0}
                    loading={addCoins.isPending}
                    onClick={onSubmit}
                >
                    {t("importCoins.submit", { count: total })}
                </Button>
            </div>
        </div>
    );
}
