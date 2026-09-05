import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { parseAsInteger, parseAsString, useQueryState } from 'nuqs'
import { useTranslation } from 'react-i18next'
import { newId } from '@mynt/core'

import { useProfileId } from '../auth/authStore'
import { useCollection } from '../collection/useCollection'
import type { TranslationKey } from '../i18n/types'
import { Button } from '../ui/Button'
import { Field } from '../ui/Field'
import { Modal } from '../ui/Modal'
import { Select } from '../ui/Select'
import { SlotGrid, type SlotCoin, type SlotTarget } from './SlotGrid'
import { SlotDialog, type SelectedSlot } from './SlotDialog'
import {
  isSlotTaken,
  useBinders,
  useCreateBinder,
  useCreatePage,
  useFileCoin,
  useMovePair,
  useUnfileCoin,
} from './useBinders'

export function Binders() {
  const { t } = useTranslation()
  const profileId = useProfileId()
  const binders = useBinders()
  const collection = useCollection()
  const createBinder = useCreateBinder()
  const createPage = useCreatePage()
  const fileCoin = useFileCoin()
  const movePair = useMovePair()
  const unfileCoin = useUnfileCoin()

  // In the query string rather than in state, so reloading or sharing the link
  // lands on the same page of the same binder. The page travels as its number
  // rather than its id: it is what the tabs are labelled with, and it survives
  // a link pasted to someone looking at their own copy of the same album.
  const [binderId, setBinderId] = useQueryState('binder', parseAsString)
  const [pageNumber, setPageNumber] = useQueryState('page', parseAsInteger)
  const [slot, setSlot] = useState<SelectedSlot | null>(null)
  const [errorKey, setErrorKey] = useState<TranslationKey | null>(null)
  const [newBinderOpen, setNewBinderOpen] = useState(false)
  const [newPageOpen, setNewPageOpen] = useState(false)

  const list = useMemo(() => binders.data ?? [], [binders.data])
  // Derived during render rather than synchronised in an effect: a selection
  // that no longer exists simply falls back to the first entry, so there is no
  // state to repair after the fact.
  const binder = list.find((b) => b.id === binderId) ?? list[0] ?? null
  const page = binder?.pages.find((p) => p.number === pageNumber) ?? binder?.pages[0] ?? null

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

  const nextPageNumber = (binder?.pages.at(-1)?.number ?? 0) + 1

  // Creating a binder or a page is a handful of clicks in the life of a
  // collection, so both live behind a button rather than as forms standing open
  // under the grid. The grid is what this page is for.
  const createBinderModal = (
    <Modal
      open={newBinderOpen}
      onClose={() => setNewBinderOpen(false)}
      title={t('binders.newBinder')}
    >
      <NewBinderForm
        busy={createBinder.isPending && !createBinder.isPaused}
        onCreate={(name) => {
          if (!profileId) return
          createBinder.mutate({ id: newId(), profileId, name })
          setNewBinderOpen(false)
        }}
      />
    </Modal>
  )

  if (binders.isPending || collection.isPending) {
    return <p className="text-sm text-muted">{t('common.loading')}</p>
  }

  if (list.length === 0) {
    return (
      <>
        <EmptyState
          title={t('binders.empty.title')}
          body={t('binders.empty.body')}
          action={t('binders.newBinder')}
          onAction={() => setNewBinderOpen(true)}
        />
        {createBinderModal}
      </>
    )
  }

  // Paused counts as pending, so filing coins offline would lock the dialog
  // after the first one. Only an in-flight request should block it.
  const busy =
    (fileCoin.isPending && !fileCoin.isPaused) ||
    (unfileCoin.isPending && !unfileCoin.isPaused)

  const close = () => {
    setSlot(null)
    setErrorKey(null)
  }

  const onError = (error: unknown) => {
    setErrorKey(isSlotTaken(error) ? 'binders.errors.slotTaken' : 'binders.errors.generic')
  }

  const onMoveError = (error: unknown) => {
    setErrorKey(isSlotTaken(error) ? 'binders.errors.slotTaken' : 'binders.errors.move')
  }

  // Dropping onto a free hole is an ordinary filing; onto an occupied one it
  // has to be the paired move, or the first update would land on a hole the
  // other coin has not left yet.
  const moveCoin = (dragged: SlotCoin, target: SlotTarget) => {
    if (!page) return
    setErrorKey(null)
    const destination = { pageId: page.id, row: target.row, column: target.column }
    if (target.coin === null) {
      fileCoin.mutate({ coinId: dragged.id, ...destination }, { onError: onMoveError })
      return
    }
    movePair.mutate(
      {
        first: { coinId: dragged.id, destination },
        second: {
          coinId: target.coin.id,
          destination: { pageId: page.id, row: dragged.slotRow, column: dragged.slotColumn },
        },
      },
      { onError: onMoveError },
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-4">
        <Select
          label={t('binders.binder')}
          value={binder?.id ?? ''}
          onChange={(e) => {
            void setBinderId(e.target.value)
            // Page numbers do not carry across binders.
            void setPageNumber(null)
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
            value={page?.number ?? ''}
            onChange={(e) => void setPageNumber(Number(e.target.value))}
          >
            {binder.pages.map((p) => (
              <option key={p.id} value={p.number}>
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
          onMove={moveCoin}
        />
      ) : (
        <EmptyState
          title={t('binders.noPages.title')}
          body={t('binders.noPages.body')}
          action={t('binders.newPage')}
          onAction={() => setNewPageOpen(true)}
        />
      )}

      {/* Adding a page is dropped from this row when there is no page yet: the
          empty state above already carries that action, and offering it twice
          would be the clutter this row exists to remove. Creating a binder
          always stays, or a binder with no pages would be a dead end. */}
      <div className="flex flex-wrap gap-3 border-t border-rule pt-6">
        {page && (
          <Button type="button" variant="ghost" onClick={() => setNewPageOpen(true)}>
            {t('binders.newPage')}
          </Button>
        )}
        <Button type="button" variant="ghost" onClick={() => setNewBinderOpen(true)}>
          {t('binders.newBinder')}
        </Button>
      </div>

      {errorKey && !slot && (
        <p role="alert" className="text-sm text-danger">
          {t(errorKey)}
        </p>
      )}

      {createBinderModal}

      <Modal open={newPageOpen} onClose={() => setNewPageOpen(false)} title={t('binders.newPage')}>
        <NewPageForm
          nextNumber={nextPageNumber}
          busy={createPage.isPending && !createPage.isPaused}
          onCreate={(rowCount, columnCount) => {
            if (!binder) return
            createPage.mutate({
              id: newId(),
              binderId: binder.id,
              number: nextPageNumber,
              rowCount,
              columnCount,
            })
            setNewPageOpen(false)
          }}
        />
      </Modal>

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

function EmptyState({
  title,
  body,
  action,
  onAction,
}: {
  title: string
  body: string
  action: string
  onAction: () => void
}) {
  return (
    <div className="rounded-xl bg-card px-6 py-14 text-center">
      <h2 className="text-2xl">{title}</h2>
      <p className="mt-2 mb-6 text-base text-muted">{body}</p>
      <Button type="button" onClick={onAction}>
        {action}
      </Button>
    </div>
  )
}

function NewBinderForm({ onCreate, busy }: { onCreate: (name: string) => void; busy: boolean }) {
  const { t } = useTranslation()
  const [name, setName] = useState('')

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    onCreate(name.trim())
    setName('')
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-4">
      <Field
        wrapperClassName="min-w-56 flex-1"
        className="w-full"
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
    <form onSubmit={submit} className="flex flex-col gap-5">
      <p className="text-base text-muted">{t('binders.pageWillBe', { number: nextNumber })}</p>
      <div className="flex flex-wrap items-end gap-4">
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
          {t('binders.create')}
        </Button>
      </div>
    </form>
  )
}
