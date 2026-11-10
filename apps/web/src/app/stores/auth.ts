import { create } from "zustand";

import {
    apiFetch,
    renewSession,
    setSession,
    subscribeToSession,
    type Session,
} from "@/app/lib/api";
import { clearPersistedCache, resumePersistence } from "@/app/lib/query-client";

/**
 * Where the app stands with the server.
 *
 * "offline" is the state that did not exist: the cookie could not be traded
 * for a token because nothing answered. Treating that as signed out -- which is
 * what happened -- put the sign-in screen in front of a persisted collection
 * that was sitting right there, and made the app useless without a signal.
 * Offline, the app shows what it has; when the network returns, the first
 * refetch renews the session or finds out it is gone.
 */
export type AuthStatus = "loading" | "signed-in" | "signed-out" | "offline";

interface AuthState {
    status: AuthStatus;
}

/**
 * Who is signed in, as the whole app sees it.
 *
 * A store rather than a context, because the value is then readable without a
 * hook -- and because a subscriber only re-renders for the slice it selected.
 *
 * The session itself is held in lib/api, which is the module that has to put the
 * token on every request. This store mirrors its status for React; the two are kept in
 * step by a subscription rather than by both being written to, so there is one
 * source and one direction.
 */
const useAuthStore = create<AuthState>(() => ({ status: "loading" }));

export const useAuthStatus = (): AuthStatus =>
    useAuthStore((state) => state.status);

/**
 * Starts the session, from the cookie alone.
 *
 * Called once from main.tsx rather than from an effect: this has nothing to do
 * with any component's lifetime, and starting it before the first render means
 * the answer is already on its way while React mounts.
 */
export function startAuthSync(): void {
    subscribeToSession((session) => {
        if (session) {
            useAuthStore.setState({ status: "signed-in" });
            // Reopened on every sign-in, or the cache would stop being saved for the
            // rest of the tab's life after one sign-out.
            resumePersistence();
            return;
        }

        useAuthStore.setState({ status: "signed-out" });
        // Every way of becoming signed out empties the cache, not only the button.
        // A session revoked from another device, or a cookie that simply expired,
        // used to leave the previous collection in IndexedDB -- and whoever signed
        // in next on this browser was shown it until the first fetch replaced it.
        void clearPersistedCache();
    });

    void renewSession().then((outcome) => {
        // "renewed" and "refused" have already reached the store through the
        // subscription. Only the absence of an answer is decided here.
        if (outcome === "unreachable")
            useAuthStore.setState({ status: "offline" });
    });
}

export async function signIn(email: string, password: string): Promise<void> {
    setSession(
        await apiFetch<Session>("/auth/sign-in", {
            method: "POST",
            body: { email, password },
            // raw: a 401 here is the answer, not an expired token to renew.
            raw: true,
        }),
    );
}

/**
 * Opens an account. Deliberately does not sign anybody in.
 *
 * The address is a claim until the mailbox it names is opened, so what comes
 * back is an acknowledgement and the screen says to go and read the message.
 */
export async function signUp(email: string, password: string): Promise<void> {
    await apiFetch<{ status: string }>("/auth/sign-up", {
        method: "POST",
        body: { email, password },
        raw: true,
    });
}

/** Confirms an address from the link, which also signs the collector in --
 *  opening the mailbox is the only thing the address was ever a claim about. */
export async function verifyEmail(token: string): Promise<void> {
    setSession(
        await apiFetch<Session>("/auth/verify-email", {
            method: "POST",
            body: { token },
            raw: true,
        }),
    );
}

/**
 * Asks for a link to choose a new password.
 *
 * Always succeeds, whether or not the address is registered -- the server
 * answers the same either way, and the screen says the same thing, because the
 * alternative is a form that tells anyone who asks whether somebody has an
 * account here.
 */
export function requestPasswordReset(email: string): Promise<void> {
    return apiFetch<void>("/auth/forgot-password", {
        method: "POST",
        body: { email },
        raw: true,
    });
}

/**
 * Sets the new password. Signs nobody in, deliberately.
 *
 * Every session has just been revoked, this browser's included, which is what a
 * reset is for. The collector signs in with the password they have just chosen.
 */
export function resetPassword(token: string, password: string): Promise<void> {
    return apiFetch<void>("/auth/reset-password", {
        method: "POST",
        body: { token, password },
        raw: true,
    });
}

/**
 * Ends the session here and on the server.
 *
 * The local half happens whatever the request did: a sign-out that fails because
 * the network is down still has to sign the collector out of this browser. The
 * cache is emptied by the subscription above, as for every other way out.
 */
export async function signOut(): Promise<void> {
    try {
        await apiFetch<void>("/auth/sign-out", { method: "POST", raw: true });
    } catch {
        // Nothing to do about it, and nothing to tell anyone.
    } finally {
        setSession(null);
    }
}
