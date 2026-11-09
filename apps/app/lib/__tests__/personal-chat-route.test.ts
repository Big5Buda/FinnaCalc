import { beforeEach, expect, it, vi } from "vitest"
const m = vi.hoisted(() => ({ access: vi.fn(), identity: vi.fn(), stream: vi.fn(), consent: vi.fn() }))
vi.mock("../paid-feature-access", () => ({ paidFeatureError: m.access }))
vi.mock("../supabase-auth", () => ({ verifiedAppUserId: m.identity }))
vi.mock("../ai-consent", () => ({ requireAIConsentHeader: m.consent }))
vi.mock("ai", () => ({ streamText: m.stream }))
vi.mock("@ai-sdk/google", () => ({ google: (model: string) => model }))
vi.mock("../ai-transcript", () => ({ recordTranscript: vi.fn(), lastUserMessage: () => "question" }))
vi.mock("../advice-guard", () => ({ SECURITIES_FENCE: "existing fence", guardTextStream: () => new ReadableStream({start(c) {c.enqueue(new TextEncoder().encode("answer"));c.close()}}) }))
import { POST } from "../../app/api/personal-chat/route"
beforeEach(() => {
    vi.resetAllMocks()
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "offline-test"
    m.identity.mockResolvedValue("user")
    m.access.mockResolvedValue(null)
    m.stream.mockReturnValue({ textStream: {}, finishReason: Promise.resolve("stop") })
})
const request = (personalContext?: unknown) => new Request("https://example.test/api/personal-chat", { method: "POST", body: JSON.stringify({ messages: [{role: "user", content: "Review my budget"}], personalContext }) })
it("authorizes context before passing it to the unchanged ordinary chat model", async () => {
    const response = await POST(request({requested: ["budgeting"], budget: "ALLOWED_CONTEXT"}))
    expect(response.status).toBe(200)
    expect(await response.text()).toBe("answer")
    const call = m.stream.mock.calls[0][0]
    expect(call.system).toContain("ALLOWED_CONTEXT")
    expect(call.system).toContain("existing fence")
    expect(call.model).toBe("gemini-3.5-flash")
    expect(call.maxOutputTokens).toBe(1500)
})
it("excludes denied context while returning a useful general chat", async () => {
    m.access.mockResolvedValue(new Response("denied", {status: 403}))
    await POST(request({requested: ["budgeting"], budget: "PRIVATE_SECRET"}))
    expect(m.stream.mock.calls[0][0].system).not.toContain("PRIVATE_SECRET")
    expect(m.stream.mock.calls[0][0].system).toContain("Budgeting Plus")
})
it("unavailable entitlement checks never call the AI model", async () => {
    m.access.mockResolvedValue(new Response("unavailable", {status: 503}))
    expect((await POST(request({requested: ["investing"], portfolio: "PRIVATE_SECRET"}))).status).toBe(503)
    expect(m.stream).not.toHaveBeenCalled()
})
it("missing consent never looks up identity, entitlements or calls the AI model", async () => {
    m.consent.mockReturnValue(new Response("consent", {status: 403}))
    expect((await POST(request({requested: ["budgeting"], budget: "PRIVATE_SECRET"}))).status).toBe(403)
    expect(m.identity).not.toHaveBeenCalled(); expect(m.access).not.toHaveBeenCalled(); expect(m.stream).not.toHaveBeenCalled()
})
