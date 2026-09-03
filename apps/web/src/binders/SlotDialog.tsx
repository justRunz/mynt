import { useTranslation } from 'react-i18next'
import { metalFamily, type FaceValueCents } from '@mynt/core'

import type { TranslationKey } from '../i18n/types'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { countryFlag, countryName } from '../lib/countries'
import { formatFaceValue } from '../lib/format'
import type { CollectionEntry } from '../collection/useCollection'
import type { SlotCoin } from './SlotGrid'

const DOT = {
  COPPER: 'bg-copper',
  NORDIC_GOLD: 'bg-nordic',
  BIMETAL: 'bg-silver',
} as const

export interface SelectedSlot {
  row: number
  column: number
  coin: SlotCoin | null
}

interface Props {
  slot: SelectedSlot | null
  unfiled: readonly CollectionEntry[]
  busy: boolean
  errorKey: TranslationKey | null
  onClose: () => void
  onPlace: (coinId: string) => void
  onRemove: (coinId: string) => void
}

export function SlotDialog({
  slot,
  unfiled,
  busy,
  errorKey,
  onClose,
  onPlace,
  onRemove,
}: Props) {
  const { t } = useTranslation()
  const position = { row: slot?.row ?? 0, column: slot?.column ?? 0 }

  // Kept mounted and driven by `open`: unmounting would cut the closing
  // animation short.
  return (
    <Modal open={slot !== null} onClose={onClose} title={t('binders.placeTitle')}>
      <div className="flex flex-col gap-5">
        <p className="text-sm text-muted">{t('binders.placeIn', position)}</p>

        {errorKey && (
          <p role="alert" className="text-sm text-danger">
            {t(errorKey)}
          </p>
        )}

        {slot?.coin ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <span className="tnum text-sm">
              <span aria-hidden>{countryFlag(slot.coin.countryCode)}</span>{' '}
              {countryName(slot.coin.countryCode)} · {formatFaceValue(slot.coin.faceValueCents)}{' '}
              · {slot.coin.year}
            </span>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => slot?.coin && onRemove(slot.coin.id)}
            >
              {t('binders.remove')}
            </Button>
          </div>
        ) : unfiled.length === 0 ? (
          <p className="text-sm text-muted">{t('binders.noUnfiled')}</p>
        ) : (
          <>
            <p className="text-sm text-muted">
              {t('binders.unfiledCount', { count: unfiled.length })}
            </p>
            <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto">
              {unfiled.map((coin) => (
                <li key={coin.id}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onPlace(coin.id)}
                    className="tnum flex w-full items-center gap-3 rounded-md border
                               border-rule px-4 py-3 text-left text-base hover:bg-band
                               disabled:opacity-50"
                  >
                    <span
                      aria-hidden
                      className={`size-2.5 shrink-0 rounded-full ${
                        DOT[metalFamily(coin.faceValueCents as FaceValueCents)]
                      }`}
                    />
                    <span aria-hidden>{countryFlag(coin.countryCode)}</span>
                    <span className="flex-1">{countryName(coin.countryCode)}</span>
                    <span>{formatFaceValue(coin.faceValueCents)}</span>
                    <span className="w-10 text-right text-muted">{coin.year}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Modal>
  )
}
