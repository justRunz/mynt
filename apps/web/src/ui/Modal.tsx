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
      className="modal m-auto w-[min(48rem,calc(100vw-2rem))] rounded-xl border
                 border-rule bg-surface p-0 text-ink shadow-overlay"
    >
      <div className="flex items-center justify-between border-b border-rule px-7 py-5">
        {/* Serif at 400 -- see the base layer in index.css. The reference never
            takes the display face above regular, at any size. */}
        <h2 className="text-2xl">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          // Icon-only, so the label moves to aria-label rather than disappearing:
          // the button still has to announce itself. The 36px box keeps the
          // target comfortably above the 24px minimum even though the glyph is
          // small.
          aria-label={t('common.close')}
          className="-mr-2 flex size-9 items-center justify-center rounded-full text-muted
                     hover:bg-card hover:text-ink"
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
      <div className="max-h-[70vh] overflow-y-auto px-7 py-6">{children}</div>
    </dialog>
  )
}
