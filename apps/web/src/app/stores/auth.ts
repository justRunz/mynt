import { create } from 'zustand'

import { apiFetch, setSession, subscribeToSession, type Session } from '@/app/lib/api'
import { clearPersistedCache, resumePersistence } from '@/app/lib/query-client'

interface AuthState {
  session: Session | null
  /** True until the refresh cookie has been traded, or found wanting. */
  loading: boolean
}

/**
 * Who is signed in, as the whole app sees it.
 *
 * A store rather than a context, because the value is then readable without a
 * hook -- and because a subscriber only re-renders for the slice it selected.
 *
 * The session itself is held in lib/api, which is the module that has to put the
 * token on every request. This store mirrors it for React; the two are kept in
 * step by a subscription rather than by both being written to, so there is one
 * source and one direction.
 */
export const useAuthStore = create<AuthState>(() => ({
  session: null,
  loading: true,
}))

/**
 * Selected as a boolean rather than by reaching for the session object.
 *
 * Every renewal produces a new object, so a component that only needs to know
 * whether anybody is signed in would re-render every fifteen minutes for an
 * answer that had not changed. A boolean compares equal and nothing moves.
 */
export const useIsSignedIn = (): boolean =>
  useAuthStore((state) => state.session !== null)

/**
 * Starts the session, from the cookie alone.
 *
 * Called once from main.tsx rather than from an effect: this has nothing to do
 * with any component's lifetime, and starting it before the first render means
 * the answer is already on its way while React mounts.
 *
 * The access token was never written down -- it lives in memory and a reload
 * loses it -- so this is how the app finds out anybody is here. A refusal is the
 * ordinary answer for a browser that has never signed in, not an error.
 */
export function startAuthSync(): void {
  subscribeToSession((session) => useAuthStore.setState({ session }))

  void apiFetch<Session>('/auth/refresh', { method: 'POST', raw: true })
    .then((session) => {
      setSession(session)
      resumePersistence()
    })
    .catch(() => setSession(null))
    .finally(() => useAuthStore.setState({ loading: false }))
}

export async function signIn(email: string, password: string): Promise<void> {
  setSession(
    await apiFetch<Session>('/auth/sign-in', {
      method: 'POST',
      body: { email, password },
      // raw: a 401 here is the answer, not an expired token to renew.
      raw: true,
    }),
  )
  // Reopened on every sign-in, or the cache would stop being saved for the rest
  // of the tab's life after one sign-out -- and reading the collection without a
  // signal is the reason it is saved at all.
  resumePersistence()
}

/**
 * Opens an account. Deliberately does not sign anybody in.
 *
 * The address is a claim until the mailbox it names is opened, so what comes
 * back is an acknowledgement and the screen says to go and read the message.
 */
export async function signUp(email: string, password: string): Promise<void> {
  await apiFetch<{ status: string }>('/auth/sign-up', {
    method: 'POST',
    body: { email, password },
    raw: true,
  })
}

/** Confirms an address from the link, which also signs the collector in --
 *  opening the mailbox is the only thing the address was ever a claim about. */
export async function verifyEmail(token: string): Promise<void> {
  setSession(
    await apiFetch<Session>('/auth/verify-email', {
      method: 'POST',
      body: { token },
      raw: true,
    }),
  )
  resumePersistence()
}

/**
 * Ends the session here and on the server, and erases what was cached.
 *
 * The cache outlives the session, so leaving it would show the next person to
 * use this browser the previous collection until the first fetch replaced it.
 *
 * The local half happens whatever the request did: a sign-out that fails because
 * the network is down still has to sign the collector out of this browser.
 */
export async function signOut(): Promise<void> {
  try {
    await apiFetch<void>('/auth/sign-out', { method: 'POST', raw: true })
  } catch {
    // Nothing to do about it, and nothing to tell anyone.
  } finally {
    setSession(null)
    await clearPersistedCache()
  }
}
