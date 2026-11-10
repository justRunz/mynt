import { describe, expect, test } from "vitest";

import { extractCoins } from "./extraction.js";

const file = { mimeType: "text/csv", data: "" };
const good = {
    countryCode: "FR",
    faceValueCents: 200,
    year: 2015,
    quantity: 3,
    variant: null,
    grade: null,
    note: null,
};

describe("extractCoins", () => {
    test("keeps the valid items and drops the rest", async () => {
        const result = await extractCoins(
            async () => ({
                items: [
                    good,
                    { ...good, faceValueCents: 3 },
                    { ...good, countryCode: "france" },
                    { ...good, quantity: 0 },
                    "nonsense",
                    { ...good, year: null, countryCode: null },
                ],
            }),
            file,
        );
        expect(result.items).toEqual([
            good,
            { ...good, year: null, countryCode: null },
        ]);
    });

    test("caps the list at 500", async () => {
        const result = await extractCoins(
            async () => ({ items: Array(600).fill(good) }),
            file,
        );
        expect(result.items).toHaveLength(500);
    });

    test("refuses an answer that is not a list of items", async () => {
        await expect(extractCoins(async () => "oops", file)).rejects.toThrow();
        await expect(extractCoins(async () => null, file)).rejects.toThrow();
    });
});
