import type { Session } from '@supabase/supabase-js'
import { create } from 'zustand'

import { clearPersistedCache } from '../app/queryClient'
import { supabase } from '../lib/supabase'

interface AuthState {
  session: Session | null
  /** True until the initial session has been resolved. */
  loading: boolean
  /** Supabase returned the user through a password reset link. */
  recovering: boolean
}

/**
 * Auth is the one piece of client state the whole app reads, and it comes from
 * outside React: Supabase pushes it in on its own schedule. A store rather than
 * a context, because the value is then readable without a hook -- a mutation or
 * a route guard can ask who is signed in without being a component -- and
 * because a subscriber only re-renders for the slice it selected.
 */
export const useAuthStore = create<AuthState>(() => ({
  session: null,
  loading: true,
  recovering: false,
}))

/**
 * The id of the signed-in profile, or null.
 *
 * Worth its own selector rather than reaching through the session: Supabase
 * hands back a brand-new session object on every token refresh, so a component
 * that only needs the id would re-render each time for a string that never
 * changed. Selecting the string compares equal and nothing moves.
 */
export const useProfileId = (): string | null =>
  useAuthStore((state) => state.session?.user.id ?? null)

export const endRecovery = () => useAuthStore.setState({ recovering: false })

/**
 * Subscribes the store to Supabase. Called once from main.tsx rather than from
 * an effect: the listener has nothing to do with any component's lifetime, and
 * starting it before the first render means the initial session is already on
 * its way while React mounts.
 */
export function startAuthSync(): void {
  void supabase.auth.getSession().then(({ data }) => {
    useAuthStore.setState({ session: data.session, loading: false })
  })

  supabase.auth.onAuthStateChange((event, session) => {
    useAuthStore.setState({ session, loading: false })
    if (event === 'PASSWORD_RECOVERY') useAuthStore.setState({ recovering: true })
    if (event === 'SIGNED_OUT') {
      useAuthStore.setState({ recovering: false })
      void clearPersistedCache()
    }
  })
}
