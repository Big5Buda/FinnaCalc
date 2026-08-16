/**
 * The browser-storage keys FinnaCalc owns, and the envelope used to move them
 * between origins.
 *
 * localStorage is scoped to an origin, so splitting the site across
 * www.finnacalc.com and app.finnacalc.com strands everything saved under the
 * old one: budgets, goals, history, the watchlist. This module is the contract
 * between the two apps — the marketing site reads these keys from the origin
 * that still holds them, and the app writes them back on its own.
 *
 * One list, shared, because a key missing from either side is data silently
 * left behind.
 */

export const STORAGE_KEYS = [
    // Budgeting (BudgetProvider)
    "finnacalc-budget-items",
    "finnacalc-savings-goals",
    "finnacalc-budget-history",
    "finnacalc-category-caps",
    "finnacalc-budget-last-slot",
    "finnacalc-budget-type",
    // Investing
    "finnacalc.watchlist",
    "finnacalc.investing.goals",
    // Preferences
    "finnacalc.appearance",
] as const

export type StorageKey = (typeof STORAGE_KEYS)[number]

/** Envelope version, so a future change can be detected rather than guessed at. */
export const HANDOFF_VERSION = 1

export type HandoffPayload = {
    v: number
    /** When the export was taken, ISO 8601. */
    at: string
    /** Only the keys that actually had a value. */
    data: Partial<Record<StorageKey, string>>
}

/** Everything FinnaCalc has stored here, or null when there's nothing to move. */
export function readLocalData(storage: Storage): HandoffPayload | null {
    const data: Partial<Record<StorageKey, string>> = {}
    for (const key of STORAGE_KEYS) {
        const value = storage.getItem(key)
        // "[]" and "{}" are real saved states (a deliberately emptied budget),
        // so only a genuinely absent key is skipped.
        if (value !== null) data[key] = value
    }
    return Object.keys(data).length > 0 ? { v: HANDOFF_VERSION, at: new Date().toISOString(), data } : null
}

/** Writes an envelope into storage. Returns the keys actually written. */
export function writeLocalData(storage: Storage, payload: HandoffPayload): StorageKey[] {
    const written: StorageKey[] = []
    for (const key of STORAGE_KEYS) {
        const value = payload.data[key]
        if (typeof value !== "string") continue
        try {
            storage.setItem(key, value)
            written.push(key)
        } catch {
            // Quota, or private mode. Carry on: a partial import that reports
            // what it managed beats an all-or-nothing failure.
        }
    }
    return written
}

export function clearLocalData(storage: Storage): void {
    for (const key of STORAGE_KEYS) storage.removeItem(key)
}

/** True when this origin already holds FinnaCalc data worth keeping. */
export function hasLocalData(storage: Storage): boolean {
    return STORAGE_KEYS.some((key) => {
        const value = storage.getItem(key)
        return value !== null && value !== "" && value !== "[]" && value !== "{}"
    })
}

// MARK: - Transport

/**
 * URL-safe base64 of the envelope. Carried in the URL *fragment*, which the
 * browser never sends to a server — so a budget doesn't end up in an access
 * log on its way across.
 */
export function encodeHandoff(payload: HandoffPayload): string {
    const json = JSON.stringify(payload)
    const bytes = new TextEncoder().encode(json)
    let binary = ""
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

export function decodeHandoff(encoded: string): HandoffPayload | null {
    try {
        const padded = encoded.replace(/-/g, "+").replace(/_/g, "/")
        const binary = atob(padded)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
        const parsed = JSON.parse(new TextDecoder().decode(bytes)) as HandoffPayload
        if (typeof parsed?.v !== "number" || typeof parsed?.data !== "object" || parsed.data === null) {
            return null
        }
        return parsed
    } catch {
        return null
    }
}

/**
 * How much encoded payload is safe to put in a URL. Browsers vary and some
 * proxies truncate; past this the file route is offered instead, because a
 * silently truncated budget is worse than an extra click.
 */
export const MAX_FRAGMENT_LENGTH = 200_000
