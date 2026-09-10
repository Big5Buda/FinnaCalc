import { afterEach, beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ auth: vi.fn() }))
vi.mock("@/lib/supabase", () => ({ supabaseAuthHeader: mocks.auth }))
import {
    AI_CONSENT_HEADER, AI_CONSENT_VALUE, ensureGoogleAIConsent, hasGoogleAIConsent,
    requireAIConsentHeader, revokeGoogleAIConsent, setAIConsentAccount,
} from "../ai-consent"
import { apiPost, postTextStream } from "../api-client"

beforeEach(() => {
    vi.resetAllMocks()
    vi.stubGlobal("window", { confirm: vi.fn().mockReturnValue(false), dispatchEvent: vi.fn() })
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => Response.json({ ok: true })))
    mocks.auth.mockResolvedValue({ Authorization: "Bearer account-token" })
    revokeGoogleAIConsent()
    setAIConsentAccount(null)
})
afterEach(() => vi.unstubAllGlobals())

it.each([undefined, "google-v1", "true"])("rejects missing/obsolete consent %s on the server", (value) => {
    const request = new Request("https://app.finnacalc.com/api/chat", { headers: value ? { [AI_CONSENT_HEADER]: value } : {} })
    expect(requireAIConsentHeader(request)?.status).toBe(403)
})
it("accepts the exact explicit adult-sharing marker", () => {
    expect(requireAIConsentHeader(new Request("https://app.finnacalc.com/api/chat", {
        headers: { [AI_CONSENT_HEADER]: AI_CONSENT_VALUE },
    }))).toBeNull()
})
it("decline keeps both streamed chat and JSON budget context off the network", async () => {
    expect(ensureGoogleAIConsent()).toBe(false)
    await expect(postTextStream("/api/chat", { messages: ["private question"] }, vi.fn())).rejects.toMatchObject({ status: 403 })
    await expect(apiPost("/api/budget-advisor", { snapshot: { private: true } })).rejects.toMatchObject({ status: 403 })
    expect(fetch).not.toHaveBeenCalled()
})
it("adds consent only to AI requests after the adult/data-sharing confirmation", async () => {
    vi.mocked(window.confirm).mockReturnValue(true)
    expect(ensureGoogleAIConsent()).toBe(true)
    expect(window.confirm).toHaveBeenCalledWith(expect.stringMatching(/18.*Google.*30 days/))
    await apiPost("/api/budget-advisor", { snapshot: {} })
    await apiPost("/api/account/delete", {})
    const calls = vi.mocked(fetch).mock.calls
    expect((calls[0][1]?.headers as Record<string, string>)[AI_CONSENT_HEADER]).toBe(AI_CONSENT_VALUE)
    expect((calls[1][1]?.headers as Record<string, string>)[AI_CONSENT_HEADER]).toBeUndefined()
})
it("account changes revoke permission instead of sharing the previous user's consent", () => {
    setAIConsentAccount("first-user")
    vi.mocked(window.confirm).mockReturnValue(true)
    ensureGoogleAIConsent()
    setAIConsentAccount("first-user")
    expect(hasGoogleAIConsent()).toBe(true)
    setAIConsentAccount("second-user")
    expect(hasGoogleAIConsent()).toBe(false)
})
it("revocation during token lookup prevents subsequent prompt transmission", async () => {
    vi.mocked(window.confirm).mockReturnValue(true)
    ensureGoogleAIConsent()
    let resume!: (value: Record<string, string>) => void
    mocks.auth.mockReturnValue(new Promise((resolve) => { resume = resolve }))
    const sending = apiPost("/api/chat", { messages: ["private question"] })
    revokeGoogleAIConsent()
    resume({ Authorization: "Bearer account-token" })
    await expect(sending).rejects.toMatchObject({ status: 403 })
    expect(fetch).not.toHaveBeenCalled()
})

it.each(["json", "stream"])("consent regrant for another account does not authorize a suspended %s prompt", async (kind) => {
    setAIConsentAccount("first-user")
    vi.mocked(window.confirm).mockReturnValue(true)
    ensureGoogleAIConsent()
    let resume!: (value: Record<string, string>) => void
    mocks.auth.mockReturnValue(new Promise((resolve) => { resume = resolve }))
    const sending = kind === "json"
        ? apiPost("/api/budget-advisor", { snapshot: { private: "first-user" } })
        : postTextStream("/api/chat", { messages: ["first-user private question"] }, vi.fn())
    setAIConsentAccount("second-user")
    ensureGoogleAIConsent()
    resume({ Authorization: "Bearer second-user-token" })
    await expect(sending).rejects.toMatchObject({ status: 403 })
    expect(fetch).not.toHaveBeenCalled()
})
