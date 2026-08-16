/**
 * Cross-subdomain auth handoff.
 *
 * The marketing site never authenticates anyone. It starts the flow — builds a
 * PKCE challenge, remembers where the visitor was and what they had typed —
 * and hands off to the app subdomain, which owns the session. This is the
 * modular, testable half of the OAuth 2.0 / OIDC PKCE flow the spec asks for;
 * the token exchange happens on the app side, against Supabase, which is
 * already a PKCE client.
 *
 * Nothing here reads or writes a real session. `useSessionHint` reports only
 * whether a session cookie appears to exist, so the header can show "Log in"
 * or "Open app" without the marketing site holding credentials it has no
 * business holding.
 */

import { useEffect, useState } from "react"
import { appUrl } from "@/lib/app-url"

const VERIFIER_KEY = "finnacalc.pkce.verifier"
const STATE_KEY = "finnacalc.pkce.state"

/** RFC 7636 §4.1 — 43…128 characters of unreserved ASCII. */
function randomString(bytes = 48): string {
    const buffer = new Uint8Array(bytes)
    crypto.getRandomValues(buffer)
    return base64url(buffer)
}

function base64url(bytes: Uint8Array): string {
    let binary = ""
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

/** S256: the challenge is the SHA-256 of the verifier, base64url encoded. */
async function challengeFor(verifier: string): Promise<string> {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))
    return base64url(new Uint8Array(digest))
}

export type HandoffOptions = {
    /** "/sign-in" or "/sign-up" on the app. */
    path?: string
    /** Where the app should land the user once they're authenticated. */
    next?: string
    /**
     * Anything the visitor built here that the app should pick up — the
     * calculator scenario, for instance. Encoded into the URL, so it survives
     * the origin change without the marketing site storing it anywhere.
     */
    payload?: Record<string, string | number>
}

/**
 * Builds the authorization URL and stashes the verifier for the app to
 * exchange. Returns the URL rather than navigating, so callers can decide
 * whether to redirect, open a tab, or just render a link.
 */
export async function beginHandoff({
    path = "/sign-up",
    next,
    payload,
}: HandoffOptions = {}): Promise<string> {
    const verifier = randomString()
    const state = randomString(16)

    // sessionStorage, deliberately: the verifier is single-use and must not
    // outlive the tab. The app reads it back through the redirect, not from
    // storage — this copy exists so a returning visitor can be matched to the
    // request they started.
    try {
        window.sessionStorage.setItem(VERIFIER_KEY, verifier)
        window.sessionStorage.setItem(STATE_KEY, state)
    } catch {
        /* private mode: the flow still works, it just can't be resumed */
    }

    const params: Record<string, string> = {
        code_challenge: await challengeFor(verifier),
        code_challenge_method: "S256",
        state,
    }
    if (next) params.next = next
    if (payload) params.scenario = encodeScenario(payload)

    return appUrl(path, params)
}

/** The verifier for the request this tab started, if it started one. */
export function pendingVerifier(): { verifier: string; state: string } | null {
    try {
        const verifier = window.sessionStorage.getItem(VERIFIER_KEY)
        const state = window.sessionStorage.getItem(STATE_KEY)
        return verifier && state ? { verifier, state } : null
    } catch {
        return null
    }
}

export function clearHandoff(): void {
    try {
        window.sessionStorage.removeItem(VERIFIER_KEY)
        window.sessionStorage.removeItem(STATE_KEY)
    } catch {
        /* nothing to clear */
    }
}

/** A scenario compact enough to ride in a query string. */
export function encodeScenario(payload: Record<string, string | number>): string {
    return btoa(JSON.stringify(payload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

export function decodeScenario(encoded: string): Record<string, string | number> | null {
    try {
        const padded = encoded.replace(/-/g, "+").replace(/_/g, "/")
        return JSON.parse(atob(padded)) as Record<string, string | number>
    } catch {
        return null
    }
}

/**
 * Whether a session cookie scoped to the parent domain appears to be present.
 *
 * A hint, not a source of truth: the real session cookie is httpOnly and
 * unreadable here by design, so the app sets a small non-sensitive companion
 * flag alongside it. When that's absent the header simply offers to log in,
 * which is the safe default either way.
 */
const SESSION_HINT_COOKIE = "fc_session"

export function useSessionHint(): { signedIn: boolean; checked: boolean } {
    const [state, setState] = useState({ signedIn: false, checked: false })

    useEffect(() => {
        const present = document.cookie
            .split(";")
            .some((entry) => entry.trim().startsWith(`${SESSION_HINT_COOKIE}=`))
        setState({ signedIn: present, checked: true })
    }, [])

    return state
}
