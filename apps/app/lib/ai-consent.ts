/** Explicit adult/data-sharing permission, separate from general app terms.
 * Kept only in this browser tab's memory and reset on account changes.
 */
export const AI_CONSENT_HEADER = "X-FinnaCalc-AI-Consent"
export const AI_CONSENT_VALUE = "google-adult-v1"
export const AI_CONSENT_CHANGED_EVENT = "finnacalc-ai-consent-changed"
export const AI_CONSENT_DISCLOSURE = "AI features are for people 18 or older. By choosing OK, you confirm you are at least 18 and allow FinnaCalc to send your messages and conversation history to Google. Budget Analysis also sends your budget summary, goals and findings; Portfolio Analysis chat includes the holdings and weights shown on screen. FinnaCalc keeps the latest question and displayed answer from each AI response, linked to your account when signed in, and schedules these records for automatic deletion after 30 days. Financial context in those messages may be retained; the structured budget snapshot is not separately stored. Google's separate provider policies also apply. You can turn sharing off in Account. Choose Cancel to keep AI off; other app features remain available."

let granted = false
let revision = 0
let accountID: string | null | undefined

export function setAIConsentAccount(next: string | null) {
    if (accountID !== next) revokeGoogleAIConsent()
    accountID = next
}
export function hasGoogleAIConsent() { return granted }
export function googleAIConsentRevision() { return revision }
export function revokeGoogleAIConsent() {
    revision += 1
    granted = false
    if (typeof window !== "undefined") window.dispatchEvent(new Event(AI_CONSENT_CHANGED_EVENT))
}
export function ensureGoogleAIConsent(): boolean {
    if (granted) return true
    if (typeof window === "undefined") return false
    granted = window.confirm(AI_CONSENT_DISCLOSURE)
    window.dispatchEvent(new Event(AI_CONSENT_CHANGED_EVENT))
    return granted
}
export function requireAIConsentHeader(request: Request): Response | null {
    if (request.headers.get(AI_CONSENT_HEADER) === AI_CONSENT_VALUE) return null
    return Response.json({ error: "AI features require confirmation that you are 18 or older and consent to sharing data with Google." }, { status: 403 })
}
