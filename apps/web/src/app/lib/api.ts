/**
 * The one place that knows where the server is and how to talk to it.
 *
 * Every read and every write goes through here, which is what makes the access
 * token a single line rather than a habit repeated in nine hooks.
 */

/**
 * Same origin in production -- one container serves the built app next to /api
 * -- so the default is a bare path and there is no cross-origin request at all.
 * Development overrides it, because the app is on 5173 and the API on 3001.
 */
const BASE = import.meta.env.VITE_API_URL ?? '/api'

export interface Session {
  userId: string
  accessToken: string
  /** Seconds the access token stays valid. */
  expiresIn: number
}

/**
 * The access token lives here, in memory, and is deliberately not written to
 * localStorage.
 *
 * Anything in localStorage is readable by every script the page ever loads, so
 * a single cross-site scripting bug hands out a session. What survives a reload
 * instead is the refresh cookie, which is httpOnly and therefore out of reach of
 * script entirely -- and the app asks /auth/refresh on load to trade it for a
 * new access token.
 *
 * The cost is one request at startup. The alternative is a token an injected
 * script can read.
 */
let session: Session | null = null

type Listener = (session: Session | null) => void
const listeners = new Set<Listener>()

export function setSession(next: Session | null): void {
  session = next
  for (const listener of listeners) listener(next)
}

/** Subscribed to by the auth store. This module never imports the store, so the
 *  dependency runs one way and there is no cycle to reason about. */
export function subscribeToSession(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * A refusal the interface can act on.
 *
 * The code is the server's own -- slot_taken, not_found, email_taken -- and it
 * is what the screens branch on and what the translations are keyed by. The
 * status is kept for the cases where the code says less than the number does.
 */
export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string) {
    super(`${status} ${code}`)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

/**
 * At most one refresh in flight, however many requests hit a 401 together.
 *
 * Loading the app fires several queries at once. Fifteen minutes in they all
 * expire at once too, and without this each would spend the refresh token
 * separately -- the second would be presenting a token the first had already
 * consumed, which the server correctly reads as theft and answers by revoking
 * the whole family. The app would sign itself out.
 */
let refreshing: Promise<boolean> | null = null

async function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const response = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!response.ok) {
        // The cookie is gone, expired, or was revoked. Either way this browser
        // is no longer signed in, and saying so puts the sign-in screen up
        // rather than leaving the app to fail one request at a time.
        setSession(null)
        return false
      }
      setSession((await response.json()) as Session)
      return true
    } catch {
      // Offline. Not a sign-out: the collection is readable from the persisted
      // cache, and the token can be renewed when the signal returns.
      return false
    } finally {
      refreshing = null
    }
  })()
  return refreshing
}

interface Options {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  /** Set for the auth routes themselves, which must not try to refresh their
   *  way out of a 401 -- that is the answer they exist to give. */
  raw?: boolean
}

async function send(path: string, options: Options): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    method: options.method ?? 'GET',
    // For the refresh cookie. It is scoped to /api/auth, so it rides along with
    // the four session routes and with nothing else.
    credentials: 'include',
    headers: {
      ...(session ? { Authorization: `Bearer ${session.accessToken}` } : {}),
      ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  })
}

/**
 * One request, renewed once if the token had expired underneath it.
 *
 * An access token lasts fifteen minutes, so a tab left open over lunch will hit
 * a 401 on the first thing it asks for. Retrying after a refresh means the
 * collector never sees that -- and it is the whole reason a short-lived token is
 * affordable in the first place.
 *
 * Exactly one retry. If the second attempt is refused too, the session is
 * genuinely over and looping would only postpone saying so.
 */
export async function apiFetch<T>(path: string, options: Options = {}): Promise<T> {
  let response = await send(path, options)

  if (response.status === 401 && !options.raw) {
    if (await refreshSession()) response = await send(path, options)
  }

  if (!response.ok) {
    const code = await response
      .json()
      .then((body: { error?: string }) => body.error ?? 'unknown')
      .catch(() => 'unknown')
    throw new ApiError(response.status, code)
  }

  // 204 on every write that has nothing to hand back. Parsing an empty body as
  // JSON throws, so the absence is answered before it is read.
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}
