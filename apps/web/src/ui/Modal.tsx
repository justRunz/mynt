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
          className="rounded-md px-2 py-1 text-sm text-muted hover:text-ink"
        >
          {t('common.close')}
        </button>
      </div>
      <div className="max-h-[70vh] overflow-y-auto px-6 py-6">{children}</div>
    </dialog>
  )
}
