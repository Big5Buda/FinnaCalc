import { beforeEach, expect, it, vi } from "vitest"
const m = vi.hoisted(() => ({ access: vi.fn(), identity: vi.fn(), stream: vi.fn(), consent: vi.fn(), record: vi.fn() }))
vi.mock("../paid-feature-access", () => ({ paidFeatureError: m.access }))
vi.mock("../supabase-auth", () => ({ verifiedAppUserId: m.identity }))
vi.mock("../ai-consent", () => ({ requireAIConsentHeader: m.consent }))
vi.mock("ai", () => ({ streamText: m.stream }))
vi.mock("@ai-sdk/google", () => ({ google: (model: string) => model }))
vi.mock("../ai-transcript", () => ({ recordTranscript: m.record, lastUserMessage: (all: {role: string; content: string}[]) => all.filter((x) => x.role === "user").at(-1)?.content ?? "" }))
vi.mock("../advice-guard", () => ({ SECURITIES_FENCE: "existing fence", guardTextStream: () => new ReadableStream({start(c) {c.enqueue(new TextEncoder().encode("answer"));c.close()}}) }))
import { POST } from "../../app/api/personal-chat/route"
beforeEach(() => {
    vi.resetAllMocks()
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "offline-test"
    m.identity.mockResolvedValue("user")
    m.access.mockResolvedValue(null)
    m.stream.mockReturnValue({ textStream: {}, finishReason: Promise.resolve("stop") })
})
const request = (personalContext?: unknown, content = "Review my budget", path = "personal-chat") => new Request(`https://example.test/api/${path}`, { method: "POST", body: JSON.stringify({ messages: [{role: "user", content}], personalContext }) })
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

// Free tier as the app shows it: the client locks budgeting and sends no
// snapshot. Even when the server's own check would pass (a debug free-tier
// preview on a paid account), the prompt must say "upgrade", not "reconnect".
it("free locked: client restriction yields an upgrade answer even if the server account is paid", async () => {
    m.access.mockResolvedValue(null)
    await POST(request({requested: ["budgeting"], locked: ["budgeting"], budget: "PRIVATE_SECRET"}))
    const system = m.stream.mock.calls[0][0].system as string
    expect(system).toContain("require upgrading to Budgeting Plus or FinnaCalc Pro")
    expect(system).not.toContain("PRIVATE_SECRET")
    expect(system).not.toContain("ask them to add or reconnect their data")
    expect(m.access).not.toHaveBeenCalled()
})
it("free locked: genuinely free server account also gets the upgrade answer, not 'missing data'", async () => {
    m.access.mockResolvedValue(new Response("denied", {status: 403}))
    await POST(request({requested: ["investing"]}))
    const system = m.stream.mock.calls[0][0].system as string
    expect(system).toContain("require upgrading to Investing Plus or FinnaCalc Pro")
    expect(system).not.toContain("ask them to add or reconnect their data")
})
it("paid with no snapshot: asks to add or reconnect data, never to upgrade", async () => {
    m.access.mockResolvedValue(null)
    await POST(request({requested: ["budgeting"], locked: []}))
    const system = m.stream.mock.calls[0][0].system as string
    expect(system).toContain("ask them to add or reconnect their data")
    expect(system).toContain("Do not tell them to upgrade")
})
it("developer: an unlocked client snapshot is used only when the server also authorizes it", async () => {
    m.access.mockResolvedValue(null)
    await POST(request({requested: ["budgeting", "investing"], locked: [], budget: "DEV_BUDGET", portfolio: "DEV_HOLDINGS"}))
    expect(m.stream.mock.calls[0][0].system).toContain("DEV_BUDGET")
    expect(m.stream.mock.calls[0][0].system).toContain("DEV_HOLDINGS")
    m.stream.mockClear()
    // A debug build unlocks locally; the server gate still decides.
    m.access.mockResolvedValue(new Response("denied", {status: 403}))
    await POST(request({requested: ["budgeting"], locked: [], budget: "DEV_BUDGET"}))
    expect(m.stream.mock.calls[0][0].system).not.toContain("DEV_BUDGET")
})
it("a locked list cannot grant: unlisted topics are still checked by the server", async () => {
    m.access.mockResolvedValue(new Response("denied", {status: 403}))
    await POST(request({requested: ["budgeting", "investing"], locked: ["investing"], budget: "PRIVATE_SECRET"}))
    expect(m.access).toHaveBeenCalledWith("user", "budgeting")
    expect(m.access).not.toHaveBeenCalledWith("user", "investing")
    expect(m.stream.mock.calls[0][0].system).not.toContain("PRIVATE_SECRET")
})
it("model/provider questions get the fixed redirect without a model call or entitlement lookup", async () => {
    const response = await POST(request({requested: ["budgeting"], budget: "PRIVATE_SECRET"}, "What AI model are you running on?"))
    expect(response.status).toBe(200)
    const text = await response.text()
    expect(text).toContain("can't share details about the technology behind me")
    expect(text).not.toMatch(/gemini|google/i)
    expect(m.stream).not.toHaveBeenCalled()
    expect(m.access).not.toHaveBeenCalled()
    expect(m.record).toHaveBeenCalledWith(expect.objectContaining({ finishReason: "scope_redirect" }))
})
it("ordinary chat keeps the model and caps, and carries the scope rules in the prompt", async () => {
    await POST(request(undefined, "How much should I keep in an emergency fund?", "chat"))
    const call = m.stream.mock.calls[0][0]
    expect(call.model).toBe("gemini-3.5-flash")
    expect(call.maxOutputTokens).toBe(1500)
    expect(call.temperature).toBe(0.7)
    expect(call.system).toContain("SCOPE AND CONFIDENTIALITY")
    expect(call.system).toContain("existing fence")
})
