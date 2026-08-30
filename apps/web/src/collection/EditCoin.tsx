import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  GRADES,
  findCoinTypeId,
  indexCoinTypes,
  type FaceValueCents,
  type Grade,
} from '@mynt/core'

import { catalogQueries } from '../app/catalog'
import type { TranslationKey } from '../i18n/types'
import { countryName } from '../lib/countries'
import { formatFaceValue } from '../lib/format'
import { Button } from '../ui/Button'
import { Field } from '../ui/Field'
import { Modal } from '../ui/Modal'
import { CountryCombobox } from './CountryCombobox'
import { FaceValuePicker } from './FaceValuePicker'
import { useDeleteCoin, useUpdateCoin } from './useCoinMutations'
import type { CollectionEntry } from './useCollection'

const CURRENT_YEAR = new Date().getFullYear()

/**
 * The modal stays mounted so its closing animation runs; only the form comes and
 * goes with the coin. The body therefore empties as the dialog fades, which is a
 * smaller price than a ref read during render or an effect copying props into
 * state.
 */
export function EditCoin({
  coin,
  onClose,
}: {
  coin: CollectionEntry | null
  onClose: () => void
}) {
  const { t } = useTranslation()

  return (
    <Modal open={coin !== null} onClose={onClose} title={t('editCoin.title')}>
      {/* Keyed on the coin, so switching to another row rebuilds the form from
          its props rather than having an effect copy them into state. */}
      {coin && <EditCoinForm key={coin.id} coin={coin} onClose={onClose} />}
    </Modal>
  )
}

function EditCoinForm({ coin, onClose }: { coin: CollectionEntry; onClose: () => void }) {
  const { t } = useTranslation()
  const coinTypes = useQuery(catalogQueries.coinTypes())
  // Every country, not only those already collected: a correction may well move
  // the coin to a country the user does not own yet.
  const countries = useQuery(catalogQueries.countries())
  const countryCodes = useMemo(
    () => (countries.data ?? []).map((c) => c.code),
    [countries.data],
  )
  const updateCoin = useUpdateCoin()
  const deleteCoin = useDeleteCoin()

  const [countryCode, setCountryCode] = useState<string | null>(coin.countryCode)
  const [faceValue, setFaceValue] = useState<FaceValueCents | null>(
    coin.faceValueCents as FaceValueCents,
  )
  const [year, setYear] = useState(String(coin.year))
  const [grade, setGrade] = useState<Grade | ''>(coin.grade ?? '')
  const [acquiredOn, setAcquiredOn] = useState(coin.acquiredOn ?? '')
  const [notes, setNotes] = useState(coin.notes ?? '')
  const [errorKey, setErrorKey] = useState<TranslationKey | null>(null)
  const [notInCatalog, setNotInCatalog] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const index = useMemo(() => indexCoinTypes(coinTypes.data ?? []), [coinTypes.data])
  // Paused counts as pending, so offline this would lock the form for good.
  const busy =
    (updateCoin.isPending && !updateCoin.isPaused) ||
    (deleteCoin.isPending && !deleteCoin.isPaused)

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    setErrorKey(null)
    setNotInCatalog(null)
    if (!countryCode || faceValue === null) return

    const parsedYear = Number(year)
    if (!/^\d{4}$/.test(year) || parsedYear < 1999 || parsedYear > CURRENT_YEAR) {
      return setErrorKey('quickAdd.errors.yearRequired')
    }

    const coinTypeId = findCoinTypeId(index, countryCode, faceValue, parsedYear)
    if (coinTypeId === null) {
      return setNotInCatalog(
        t('quickAdd.errors.notInCatalog', {
          country: countryName(countryCode),
          value: formatFaceValue(faceValue),
          year: parsedYear,
        }),
      )
    }

    updateCoin.mutate(
      {
        coinId: coin.id,
        coinTypeId,
        grade: grade || null,
        acquiredOn: acquiredOn || null,
        notes: notes.trim() || null,
        countryCode,
        faceValueCents: faceValue,
        year: parsedYear,
      },
      { onError: () => setErrorKey('binders.errors.generic') },
    )
    // Closed as soon as the change is queued: offline the mutation stays paused,
    // and waiting on it would trap the user in the dialog.
    onClose()
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <CountryCombobox
        codes={countryCodes}
        value={countryCode}
        onChange={setCountryCode}
        initialQuery={countryName(coin.countryCode)}
      />

      <FaceValuePicker name="edit-face-value" value={faceValue} onChange={setFaceValue} />

      <div className="flex flex-wrap items-end gap-4">
        <Field
          label={t('quickAdd.year')}
          inputMode="numeric"
          maxLength={4}
          className="tnum w-28"
          value={year}
          onChange={(e) => setYear(e.target.value.replace(/\D/g, ''))}
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="edit-grade" className="text-sm font-medium text-muted">
            {t('quickAdd.grade')}
          </label>
          <select
            id="edit-grade"
            value={grade}
            onChange={(e) => setGrade(e.target.value as Grade | '')}
            className="h-10 rounded-md border border-field bg-raised px-2 text-sm"
          >
            <option value="">{t('quickAdd.gradeNone')}</option>
            {GRADES.map((g) => (
              <option key={g} value={g}>
                {t(`grade.${g}`)}
              </option>
            ))}
          </select>
        </div>

        <Field
          label={t('editCoin.acquiredOn')}
          type="date"
          className="w-44"
          value={acquiredOn}
          onChange={(e) => setAcquiredOn(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="edit-notes" className="text-sm font-medium text-muted">
          {t('editCoin.notes')}
        </label>
        <textarea
          id="edit-notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t('editCoin.notesPlaceholder')}
          className="rounded-md border border-field bg-raised px-3 py-2 text-sm
                     placeholder:text-muted"
        />
      </div>

      {errorKey && (
        <p role="alert" className="text-sm text-danger">
          {t(errorKey)}
        </p>
      )}
      {notInCatalog && (
        <p role="alert" className="max-w-prose text-sm text-danger">
          {notInCatalog}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-4">
        {confirmingDelete ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-danger">{t('editCoin.deleteWarning')}</span>
            <Button
              type="button"
              variant="ghost"
              className="text-danger"
              disabled={busy}
              onClick={() => {
                deleteCoin.mutate(coin.id)
                onClose()
              }}
            >
              {t('editCoin.confirmDelete')}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setConfirmingDelete(false)}>
              {t('editCoin.cancelDelete')}
            </Button>
          </div>
        ) : (
          // Two steps, because deleting a coin cannot be undone.
          <Button
            type="button"
            variant="ghost"
            className="text-danger"
            onClick={() => setConfirmingDelete(true)}
          >
            {t('editCoin.delete')}
          </Button>
        )}

        <Button type="submit" disabled={busy}>
          {t('editCoin.save')}
        </Button>
      </div>
    </form>
  )
}
