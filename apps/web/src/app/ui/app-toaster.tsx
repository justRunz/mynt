import { Toaster } from 'sonner'

/** One look for every toaster: the page's and each modal's. */
export function AppToaster({ id }: { id?: string }) {
  return <Toaster id={id} position="bottom-center" richColors closeButton />
}
