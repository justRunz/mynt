import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { useAuth } from '../auth/authContext'
import { useCollection } from '../collection/useCollection'
import type { TranslationKey } from '../i18n/types'
import { Button } from '../ui/Button'
import { Field } from '../ui/Field'
import { Select } from '../ui/Select'
import { SlotGrid, type SlotCoin } from './SlotGrid'
import { SlotDialog, type SelectedSlot } from './SlotDialog'
import {
  SLOT_TAKEN,
  useBinders,
  useCreateBinder,
  useCreatePage,
  useFileCoin,
  useUnfileCoin,
} from './useBinders'

export function Binders() {
  const { t } = useTranslation()
  const { session } = useAuth()
  const binders = useBinders()
  const collection = useCollection()
  const createBinder = useCreateBinder()
  const createPage = useCreatePage()
  const fileCoin = useFileCoin()
  const unfileCoin = useUnfileCoin()

  const [binderId, setBinderId] = useState<string | null>(null)
  const [pageId, setPageId] = useState<string | null>(null)
  const [slot, setSlot] = useState<SelectedSlot | null>(null)
  const [errorKey, setErrorKey] = useState<TranslationKey | null>(null)

  const list = useMemo(() => binders.data ?? [], [binders.data])
  // Derived during render rather than synchronised in an effect: a selection
  // that no longer exists simply falls back to the first entry, so there is no
  // state to repair after the fact.
  const binder = list.find((b) => b.id === binderId) ?? list[0] ?? null
  const page = binder?.pages.find((p) => p.id === pageId) ?? binder?.pages[0] ?? null

  const entries = useMemo(() => collection.data ?? [], [collection.data])
  const pageCoins = useMemo<SlotCoin[]>(
    () =>
      entries
        .filter((entry) => entry.location?.pageId === page?.id)
        .map((entry) => ({
          ...entry,
          slotRow: entry.location?.row ?? 0,
          slotColumn: entry.location?.column ?? 0,
        })),
    [entries, page?.id],
  )
  const unfiled = useMemo(() => entries.filter((entry) => entry.location === null), [entries])

  if (binders.isPending || collection.isPending) {
    return <p className="text-sm text-muted">{t('common.loading')}</p>
  }

  if (list.length === 0) {
    return (
      <NewBinderForm
        onCreate={(name) =>
          session && createBinder.mutate({ profileId: session.user.id, name })
        }
        busy={createBinder.isPending}
        standalone
      />
    )
  }

  const busy = fileCoin.isPending || unfileCoin.isPending

  const close = () => {
    setSlot(null)
    setErrorKey(null)
  }

  const onError = (error: unknown) => {
    const code = (error as { code?: string } | null)?.code
    setErrorKey(code === SLOT_TAKEN ? 'binders.errors.slotTaken' : 'binders.errors.generic')
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-4">
        <Select
          label={t('binders.binder')}
          value={binder?.id ?? ''}
          onChange={(e) => {
            setBinderId(e.target.value)
            setPageId(null)
          }}
        >
          {list.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>

        {binder && binder.pages.length > 0 && (
          <Select
            label={t('binders.page')}
            value={page?.id ?? ''}
            onChange={(e) => setPageId(e.target.value)}
          >
            {binder.pages.map((p) => (
              <option key={p.id} value={p.id}>
                {t('binders.pageNumber', { number: p.number })}
              </option>
            ))}
          </Select>
        )}
      </div>

      {page ? (
        <SlotGrid
          rowCount={page.rowCount}
          columnCount={page.columnCount}
          coins={pageCoins}
          onSelect={setSlot}
        />
      ) : (
        <div className="rounded-lg border border-dashed border-rule px-6 py-10 text-center">
          <p className="font-medium">{t('binders.noPages.title')}</p>
          <p className="mt-1 text-sm text-muted">{t('binders.noPages.body')}</p>
        </div>
      )}

      {binder && (
        <NewPageForm
          nextNumber={(binder.pages.at(-1)?.number ?? 0) + 1}
          busy={createPage.isPending}
          onCreate={(rowCount, columnCount) =>
            createPage.mutate({
              binderId: binder.id,
              number: (binder.pages.at(-1)?.number ?? 0) + 1,
              rowCount,
              columnCount,
            })
          }
        />
      )}

      <NewBinderForm
        onCreate={(name) =>
          session && createBinder.mutate({ profileId: session.user.id, name })
        }
        busy={createBinder.isPending}
      />

      <SlotDialog
        slot={slot}
        unfiled={unfiled}
        busy={busy}
        errorKey={errorKey}
        onClose={close}
        onPlace={(coinId) => {
          if (!page || !slot) return
          setErrorKey(null)
          fileCoin.mutate(
            { coinId, pageId: page.id, row: slot.row, column: slot.column },
            { onSuccess: close, onError },
          )
        }}
        onRemove={(coinId) => {
          setErrorKey(null)
          unfileCoin.mutate(coinId, { onSuccess: close, onError })
        }}
      />
    </div>
  )
}

function NewBinderForm({
  onCreate,
  busy,
  standalone = false,
}: {
  onCreate: (name: string) => void
  busy: boolean
  standalone?: boolean
}) {
  const { t } = useTranslation()
  const [name, setName] = useState('')

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    onCreate(name.trim())
    setName('')
  }

  return (
    <form
      onSubmit={submit}
      className={`flex flex-wrap items-end gap-3 ${
        standalone
          ? 'rounded-lg border border-dashed border-rule px-6 py-10'
          : 'border-t border-rule pt-6'
      }`}
    >
      {standalone && (
        <div className="w-full text-center">
          <p className="font-medium">{t('binders.empty.title')}</p>
          <p className="mt-1 mb-4 text-sm text-muted">{t('binders.empty.body')}</p>
        </div>
      )}
      <Field
        label={t('binders.newBinderName')}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t('binders.newBinder')}
      />
      <Button type="submit" disabled={busy || !name.trim()}>
        {t('binders.create')}
      </Button>
    </form>
  )
}

function NewPageForm({
  nextNumber,
  busy,
  onCreate,
}: {
  nextNumber: number
  busy: boolean
  onCreate: (rowCount: number, columnCount: number) => void
}) {
  const { t } = useTranslation()
  // Album sheets come in many formats depending on coin diameter, hence the
  // dimensions being asked for rather than fixed.
  const [rows, setRows] = useState('4')
  const [columns, setColumns] = useState('5')

  function submit(event: FormEvent) {
    event.preventDefault()
    const r = Number(rows)
    const c = Number(columns)
    if (r > 0 && c > 0) onCreate(r, c)
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3 border-t border-rule pt-6">
      <Field
        label={t('binders.pageRows')}
        inputMode="numeric"
        className="w-20"
        value={rows}
        onChange={(e) => setRows(e.target.value.replace(/\D/g, ''))}
      />
      <Field
        label={t('binders.pageColumns')}
        inputMode="numeric"
        className="w-20"
        value={columns}
        onChange={(e) => setColumns(e.target.value.replace(/\D/g, ''))}
      />
      <Button type="submit" disabled={busy}>
        {t('binders.newPage')} {nextNumber}
      </Button>
    </form>
  )
}
