import { toast } from 'sonner'

/**
 * A modal <dialog> sits in the top layer and makes the rest of the page inert,
 * so a toaster mounted at the app root would show *behind* an open form and
 * go unannounced. Each Modal therefore mounts its own toaster under this id,
 * and a form's toasts are addressed to it.
 */
export const MODAL_TOASTER = 'modal'

/** An error raised by a form inside a modal. */
export function modalError(message: string) {
  toast.error(message, { toasterId: MODAL_TOASTER })
}
