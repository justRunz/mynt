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
 * A panel sliding in from the left edge, built on the native <dialog> for the
 * same reason Modal is: the browser already gives the focus trap, Escape to
 * close, an inert background and the top layer. Only the geometry differs --
 * pinned to the edge and the full height of the viewport rather than centred.
 */
export function Drawer({ open, onClose, title, children }: Props) {
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
      // The backdrop belongs to the dialog box, so a click landing on the
      // element itself is a click outside the panel.
      onClick={(event) => {
        if (event.target === ref.current) onClose()
      }}
      aria-label={title}
      className="drawer h-dvh max-h-dvh w-[min(18rem,80vw)] max-w-none rounded-r-xl
                 bg-surface p-0 text-ink shadow-overlay"
    >
      <div className="flex h-full gap-1 p-6 pr-3">
        <div className="flex min-w-0 flex-1 flex-col gap-8">
          <div className="flex items-center justify-between">
            <span className="font-serif text-xl">{title}</span>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('common.close')}
              className="flex size-11 items-center justify-center rounded-md text-muted
                         hover:bg-hover hover:text-ink"
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
          {children}
        </div>

        {/* The grabber of the reference drawer, turned on its side for a panel
            that arrives from the left. Decoration only -- the panel is not
            draggable, so it must not announce itself as a control. */}
        <span aria-hidden className="my-auto h-12 w-1 shrink-0 rounded-full bg-rule" />
      </div>
    </dialog>
  )
}
