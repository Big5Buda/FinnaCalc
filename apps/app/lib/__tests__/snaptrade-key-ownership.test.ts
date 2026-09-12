import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import axios, { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from "axios"
import { createHmac } from "node:crypto"
import { NextRequest } from "next/server"

type Row = { user_id: string; st_user_id: string; st_user_secret: string; client_id: string | null }
const state = vi.hoisted(() => ({
    rows: new Map<string, Row>(), writes: vi.fn(), rpc: vi.fn(),
    account: "app-user", dbError: false, free: false,
}))
vi.mock("@/lib/supabase-auth", () => ({ verifiedAppUserId: async () => state.account }))
vi.mock("@/lib/paid-feature-access", () => ({ paidFeatureError: async () => state.free ? Response.json({}, { status: 403 }) : null }))
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({
    from: () => ({
        select: () => ({
            eq: (column: string, value: string) => ({ maybeSingle: async () => ({
                data: [...state.rows.values()].find(row => row[column as keyof Row] === value) ?? null,
                error: state.dbError ? { message: "fixture storage failure" } : null,
            }) }),
            lt: async () => ({ data: [...state.rows.values()], error: null }),
        }),
        upsert: async (row: Row) => {
            state.writes(row)
            if (!state.rows.has(row.user_id)) state.rows.set(row.user_id, row)
            return { error: null }
        },
    }),
    rpc: async (name: string, args: { p_user_id: string; p_client_id: string; p_st_user_id: string }) => {
        state.rpc(name, args)
        const row = state.rows.get(args.p_user_id)
        if (row && (row.client_id !== args.p_client_id || row.st_user_id !== args.p_st_user_id)) {
            return { error: { message: "snaptrade_session_owner_changed" } }
        }
        state.rows.delete(args.p_user_id)
        return { error: null }
    },
}) }))

const active = "production-fixture"
const legacy = "test-fixture"
const originalAdapter = axios.defaults.adapter
let calls: InternalAxiosRequestConfig[]
let deletionStatus: number
function seed(clientId: string | null = legacy) {
    const row = { user_id: state.account, st_user_id: "existing-user", st_user_secret: "fixture-user-secret", client_id: clientId }
    state.rows.set(state.account, row)
    return row
}
function request(path: string, body = {}) {
    return new NextRequest(`https://example.test/api/${path}`, { method: "POST", body: JSON.stringify(body) })
}
beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    state.rows.clear(); state.dbError = false; state.account = "app-user"; state.free = false
    calls = []; deletionStatus = 200
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.test")
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "fixture-service-role")
    vi.stubEnv("CRON_SECRET", "fixture-cron")
    vi.stubEnv("SNAPTRADE_CLIENT_ID", legacy)
    vi.stubEnv("SNAPTRADE_CONSUMER_KEY", "fixture-legacy-key")
    vi.stubEnv("SNAPTRADE_NEXT_CLIENT_ID", active)
    vi.stubEnv("SNAPTRADE_NEXT_CONSUMER_KEY", "fixture-active-key")
    vi.stubEnv("SNAPTRADE_USE_PRODUCTION_KEY", "true")
    // Actual installed SDK builds/signs requests. Its transport never reaches a network.
    axios.defaults.adapter = async (config) => {
        calls.push(config)
        let data: unknown = []
        if (config.url?.includes("registerUser")) data = { userId: JSON.parse(config.data).userId, userSecret: "new-fixture-secret" }
        if (config.url?.includes("/login")) data = { redirectURI: "https://example.test/portal" }
        const response = { config, status: 200, statusText: "OK", headers: new AxiosHeaders(), data }
        if (config.url?.includes("deleteUser") && deletionStatus !== 200) {
            response.status = deletionStatus
            throw new AxiosError("Fixture rejection", undefined, config, undefined, response)
        }
        return response
    }
})
afterEach(() => { axios.defaults.adapter = originalAdapter; vi.unstubAllEnvs(); vi.restoreAllMocks() })

function expectRequestsOwnedBy(clientId: string) {
    expect(calls.length).toBeGreaterThan(0)
    for (const call of calls) expect(new URL(call.url!, "https://api.snaptrade.com").searchParams.get("clientId")).toBe(clientId)
}

describe("SnapTrade key ownership", () => {
    it.each([legacy, active])("routes existing %s connect and reads with its own key", async (clientId) => {
        const original = seed(clientId)
        const { POST } = await import("../../app/api/snaptrade/connect/route")
        expect((await POST(request("snaptrade/connect"))).status).toBe(200)
        const { GET } = await import("../../app/api/snaptrade/accounts/route")
        expect((await GET(new NextRequest("https://example.test/api/snaptrade/accounts"))).status).toBe(200)
        expectRequestsOwnedBy(clientId)
        expect(state.rows.get(state.account)).toEqual(original)
        expect(state.writes).not.toHaveBeenCalled()
        expect(calls.some(c => c.url?.includes("registerUser"))).toBe(false)
    })
    it("registers a new user only on the active key and stores that ownership", async () => {
        const { resolveOrCreateSession } = await import("../snaptrade-session")
        const session = await resolveOrCreateSession(state.account)
        expect(session.clientId).toBe(active)
        expect(state.rows.get(state.account)?.client_id).toBe(active)
        expectRequestsOwnedBy(active)
        expect(await resolveOrCreateSession(state.account)).toEqual(session)
        expect(calls).toHaveLength(1)
    })
    it.each([null, "unknown-client"])("preserves %s ownership without registering or deleting", async clientId => {
        const original = seed(clientId)
        const { resolveOrCreateSession } = await import("../snaptrade-session")
        await expect(resolveOrCreateSession(state.account)).rejects.toThrow()
        const { POST } = await import("../../app/api/snaptrade/disconnect/route")
        vi.spyOn(console, "error").mockImplementation(() => {})
        expect((await POST(request("snaptrade/disconnect"))).status).toBe(500)
        expect(calls).toHaveLength(0)
        expect(state.rpc).not.toHaveBeenCalled()
        expect(state.rows.get(state.account)).toEqual(original)
    })
    it("missing legacy credentials never fall back to the active key", async () => {
        seed(); vi.stubEnv("SNAPTRADE_CONSUMER_KEY", "")
        const { loadSession } = await import("../snaptrade-session")
        await expect(loadSession(state.account)).rejects.toThrow("preserved")
        expect(calls).toHaveLength(0)
    })
    it("retains a stored production user's access after registration flag rollback", async () => {
        seed(active); vi.stubEnv("SNAPTRADE_USE_PRODUCTION_KEY", "")
        const { loadSession } = await import("../snaptrade-session")
        expect((await loadSession(state.account))?.clientId).toBe(active)
        const { GET } = await import("../../app/api/snaptrade/accounts/route")
        expect((await GET(new NextRequest("https://example.test/api/snaptrade/accounts"))).status).toBe(200)
        expectRequestsOwnedBy(active)
    })
    it.each(["", "false", "TRUE", "1"])("uses the original key for new users when production flag is %s", async flag => {
        vi.stubEnv("SNAPTRADE_USE_PRODUCTION_KEY", flag)
        const { resolveOrCreateSession } = await import("../snaptrade-session")
        expect((await resolveOrCreateSession(state.account)).clientId).toBe(legacy)
        expectRequestsOwnedBy(legacy)
    })
    it("does not fall back for new users when an enabled production key is incomplete", async () => {
        vi.stubEnv("SNAPTRADE_NEXT_CONSUMER_KEY", "")
        const { resolveOrCreateSession } = await import("../snaptrade-session")
        await expect(resolveOrCreateSession(state.account)).rejects.toThrow("not configured")
        expect(calls).toHaveLength(0)
        expect(state.writes).not.toHaveBeenCalled()
    })
    it("keeps original users available when the enabled registration key is incomplete", async () => {
        seed(); vi.stubEnv("SNAPTRADE_NEXT_CONSUMER_KEY", "")
        const { GET } = await import("../../app/api/snaptrade/accounts/route")
        expect((await GET(new NextRequest("https://example.test/api/snaptrade/accounts"))).status).toBe(200)
        expectRequestsOwnedBy(legacy)
    })
    it("rejects conflicting keys assigned to the same client ID", async () => {
        seed(); vi.stubEnv("SNAPTRADE_NEXT_CLIENT_ID", legacy)
        const { loadSession } = await import("../snaptrade-session")
        await expect(loadSession(state.account)).rejects.toThrow("conflicts")
        expect(calls).toHaveLength(0)
    })
    it.each([legacy, active])("accepts an actual SDK404 retry only from owner %s", async clientId => {
        seed(clientId); deletionStatus = 404
        const { POST } = await import("../../app/api/snaptrade/disconnect/route")
        expect((await POST(request("snaptrade/disconnect"))).status).toBe(200)
        expectRequestsOwnedBy(clientId)
        expect(state.rpc).toHaveBeenCalledWith("delete_snaptrade_session", {
            p_user_id: state.account, p_client_id: clientId, p_st_user_id: "existing-user",
        })
        expect(state.rows.size).toBe(0)
    })
    it("retains credentials after owner-key authorization failure", async () => {
        seed(); deletionStatus = 403
        vi.spyOn(console, "error").mockImplementation(() => {})
        const { POST } = await import("../../app/api/snaptrade/disconnect/route")
        expect((await POST(request("snaptrade/disconnect"))).status).toBe(500)
        expectRequestsOwnedBy(legacy)
        expect(state.rows.size).toBe(1)
        expect(state.rpc).not.toHaveBeenCalled()
    })
    it("does not delete a replacement mapping with stale accepted-deletion identity", async () => {
        seed(active)
        const { deleteSession } = await import("../snaptrade-session")
        await expect(deleteSession(state.account, { clientId: legacy, userId: "existing-user" })).rejects.toThrow("owner_changed")
        expect(state.rows.size).toBe(1)
    })
    it.each([legacy, active])("routes dormant %s deletion and SDK404 retry through its owner", async clientId => {
        seed(clientId); state.free = true; deletionStatus = 404
        const { GET } = await import("../../app/api/cron/prune-connections/route")
        const response = await GET(new NextRequest("https://example.test/api/cron/prune-connections", {
            headers: { authorization: "Bearer fixture-cron" },
        }))
        expect(await response.json()).toMatchObject({ removed: 1, errors: [] })
        expectRequestsOwnedBy(clientId)
        expect(state.rpc).toHaveBeenCalledWith("delete_snaptrade_session", {
            p_user_id: state.account, p_client_id: clientId, p_st_user_id: "existing-user",
        })
    })
    it("retains dormant users whose owning key is unknown", async () => {
        const original = seed("unknown-client"); state.free = true
        const { GET } = await import("../../app/api/cron/prune-connections/route")
        const response = await GET(new NextRequest("https://example.test/api/cron/prune-connections", {
            headers: { authorization: "Bearer fixture-cron" },
        }))
        expect(await response.json()).toMatchObject({ removed: 0, errors: ["snaptrade app-user"] })
        expect(calls).toHaveLength(0)
        expect(state.rpc).not.toHaveBeenCalled()
        expect(state.rows.get(state.account)).toEqual(original)
    })
    it("partitions broker catalog caching by owner key", async () => {
        const { GET } = await import("../../app/api/snaptrade/brokerages/route")
        const req = new NextRequest("https://example.test/api/snaptrade/brokerages")
        seed(legacy); await GET(req)
        seed(active); await GET(req)
        expect(calls).toHaveLength(2)
        expect(new URL(calls[0].url!, "https://api.snaptrade.com").searchParams.get("clientId")).toBe(legacy)
        expect(new URL(calls[1].url!, "https://api.snaptrade.com").searchParams.get("clientId")).toBe(active)
        await GET(req); expect(calls).toHaveLength(2)
    })
})

describe("SnapTrade webhook namespaces", () => {
    async function webhook(key: string, override: Record<string, unknown> = {}) {
        const payload = { eventTimestamp: new Date().toISOString(), eventType: "CONNECTION_ADDED", userId: "existing-user", ...override }
        const sorted = Object.fromEntries(Object.entries(payload).sort(([a], [b]) => a.localeCompare(b)))
        const signature = createHmac("sha256", key).update(JSON.stringify(sorted)).digest("base64")
        const { POST } = await import("../../app/api/snaptrade/webhook/route")
        return POST(new NextRequest("https://example.test/api/snaptrade/webhook", {
            method: "POST", headers: { signature }, body: JSON.stringify(payload),
        }))
    }
    it.each([[legacy, "fixture-legacy-key"], [active, "fixture-active-key"]])("accepts matching %s signatures", async (clientId, key) => {
        seed(clientId); vi.spyOn(console, "info").mockImplementation(() => {})
        expect((await webhook(key)).status).toBe(200)
        expect(state.rpc).not.toHaveBeenCalled()
    })
    it("rejects a valid signature from a different owner's key", async () => {
        seed(legacy)
        expect((await webhook("fixture-active-key")).status).toBe(403)
    })
    it("ignores unknown/deleted users without recreating a binding", async () => {
        expect((await webhook("fixture-legacy-key")).status).toBe(200)
        expect(state.writes).not.toHaveBeenCalled()
    })
    it("rejects forged and stale events", async () => {
        seed()
        expect((await webhook("forged-fixture-key")).status).toBe(401)
        expect((await webhook("fixture-legacy-key", { eventTimestamp: "2020-01-01T00:00:00Z" })).status).toBe(400)
    })
    it("retains stored production webhook ownership after registration flag rollback", async () => {
        seed(active); vi.stubEnv("SNAPTRADE_USE_PRODUCTION_KEY", "")
        vi.spyOn(console, "info").mockImplementation(() => {})
        expect((await webhook("fixture-active-key")).status).toBe(200)
    })
    it("retries storage uncertainty without acting on the event", async () => {
        seed(); state.dbError = true
        expect((await webhook("fixture-legacy-key")).status).toBe(503)
    })
})
