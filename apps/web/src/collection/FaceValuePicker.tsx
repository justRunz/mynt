import { useTranslation } from 'react-i18next'
import { FACE_VALUES_CENTS, metalFamily, type FaceValueCents } from '@mynt/core'

import { formatFaceValue } from '../lib/format'

const METAL_DOT = {
  COPPER: 'bg-copper',
  NORDIC_GOLD: 'bg-nordic',
  BIMETAL: 'bg-silver',
} as const

interface Props {
  /** Distinct per instance, or two pickers on one page would share a group. */
  name: string
  value: FaceValueCents | null
  onChange: (value: FaceValueCents) => void
  firstRef?: React.Ref<HTMLInputElement>
}

/**
 * A radio group rather than a select: eight options are worth one click each,
 * and showing the metal of every denomination turns picking into recognising.
 */
export function FaceValuePicker({ name, value, onChange, firstRef }: Props) {
  const { t } = useTranslation()

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium text-muted">
        {t('quickAdd.faceValue')}
      </legend>
      <div className="flex flex-wrap gap-2">
        {FACE_VALUES_CENTS.map((cents, index) => (
          <label
            key={cents}
            className={`tnum flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2
                        text-sm ${
                          value === cents
                            ? 'border-ink bg-ink text-surface'
                            : 'border-field bg-raised'
                        }`}
          >
            <input
              ref={index === 0 ? firstRef : undefined}
              type="radio"
              name={name}
              value={cents}
              // A visually hidden input in a label exposes "on" as its name, so
              // the label has to be spelled out.
              aria-label={formatFaceValue(cents)}
              className="sr-only"
              checked={value === cents}
              onChange={() => onChange(cents)}
            />
            <span aria-hidden className={`size-2.5 rounded-full ${METAL_DOT[metalFamily(cents)]}`} />
            {formatFaceValue(cents)}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
