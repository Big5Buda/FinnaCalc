import { supabaseAuthHeader } from "@/lib/supabase"
import { AI_CONSENT_HEADER, AI_CONSENT_VALUE, googleAIConsentRevision, hasGoogleAIConsent } from "@/lib/ai-consent"

/**
 * Thin client for our own API routes — the browser twin of the iOS app's
 * Core/Networking/APIClient.swift. Routes that verify the signed-in user read
 * the Supabase access token from the Authorization header, so every call
 * carries it when there is a session.
 */

export class ApiError extends Error {
    readonly status: number
    /** 503 — the feature's backend isn't configured (no keys yet). */
    readonly notConfigured: boolean

    constructor(message: string, status: number) {
        super(message)
        this.name = "ApiError"
        this.status = status
        this.notConfigured = status === 503
    }
}

async function errorFrom(res: Response): Promise<ApiError> {
    let message = `Request failed (${res.status}).`
    const text = await res.text().catch(() => "")
    if (text) {
        try {
            const parsed = JSON.parse(text)
            if (parsed?.error) message = String(parsed.error)
            else message = text
        } catch {
            message = text
        }
    }
    return new ApiError(message, res.status)
}

export async function apiGet<T>(path: string, query: Record<string, string> = {}): Promise<T> {
    const url = new URL(path, window.location.origin)
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value)
    const res = await fetch(url.toString(), { headers: await supabaseAuthHeader() })
    if (!res.ok) throw await errorFrom(res)
    return (await res.json()) as T
}

export async function apiPost<T>(path: string, body: unknown = {}): Promise<T> {
    const consentRevision = googleAIConsentRevision()
    const consent = aiConsentHeaders(path, consentRevision)
    const auth = await supabaseAuthHeader()
    aiConsentHeaders(path, consentRevision)
    const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...auth, ...consent },
        body: JSON.stringify(body),
    })
    if (!res.ok) throw await errorFrom(res)
    const text = await res.text()
    aiConsentHeaders(path, consentRevision)
    return (text ? JSON.parse(text) : {}) as T
}

/**
 * POST a JSON body and stream a plain-text response (/api/chat). `onText`
 * receives the cumulative text so far, matching the iOS client's contract.
 */
export async function postTextStream(
    path: string,
    body: unknown,
    onText: (accumulated: string) => void,
    signal?: AbortSignal
): Promise<void> {
    const consentRevision = googleAIConsentRevision()
    const consent = aiConsentHeaders(path, consentRevision)
    const auth = await supabaseAuthHeader()
    aiConsentHeaders(path, consentRevision)
    const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...auth, ...consent },
        body: JSON.stringify(body),
        signal,
    })
    if (!res.ok) throw await errorFrom(res)
    aiConsentHeaders(path, consentRevision)
    if (!res.body) throw new ApiError("No response from the server.", 500)

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let accumulated = ""
    for (;;) {
        const { done, value } = await reader.read()
        try { aiConsentHeaders(path, consentRevision) } catch (error) {
            await reader.cancel().catch(() => {})
            throw error
        }
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        onText(accumulated)
    }
}

function aiConsentHeaders(path: string, expectedRevision: number): Record<string, string> {
    if (path !== "/api/chat" && path !== "/api/budget-advisor") return {}
    if (!hasGoogleAIConsent() || googleAIConsentRevision() !== expectedRevision) throw new ApiError("AI sharing is off. Confirm that you are 18 or older and consent to sharing with Google before using AI.", 403)
    return { [AI_CONSENT_HEADER]: AI_CONSENT_VALUE }
}
