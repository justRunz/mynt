import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

/**
 * Built on the native <dialog>, which already provides the focus trap, Escape
 * to close, an inert background and the top layer. A library would add a
 * dependency to reimplement what the browser ships.
 */
export function Modal({ open, onClose, title, children }: Props) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      // Native dialogs do not close on a backdrop click; the backdrop is part of
      // the dialog box, so a click landing on the element itself is outside the
      // content.
      onClick={(event) => {
        if (event.target === ref.current) onClose()
      }}
      className="modal m-auto w-[min(48rem,calc(100vw-2rem))] rounded-lg border
                 border-rule bg-surface p-0 text-ink"
    >
      <div className="flex items-center justify-between border-b border-rule px-6 py-4">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          // Icon-only, so the label moves to aria-label rather than disappearing:
          // the button still has to announce itself. The 36px box keeps the
          // target comfortably above the 24px minimum even though the glyph is
          // small.
          aria-label={t('common.close')}
          className="-mr-2 flex size-9 items-center justify-center rounded-md text-muted
                     hover:bg-rule/60 hover:text-ink"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
          </svg>
        </button>
      </div>
      <div className="max-h-[70vh] overflow-y-auto px-6 py-6">{children}</div>
    </dialog>
  )
}
