import { afterEach, beforeEach, expect, it, vi } from "vitest"
const m = vi.hoisted(() => ({ lookup: vi.fn(), namespace: vi.fn(), selected: vi.fn(), clients: new Map<string, any>() }))
vi.mock("../snaptrade", () => ({ snapTradeKeyNamespace: m.namespace, getSnapTrade: ({ clientId }: any) => {
    m.selected(clientId)
    if (!m.clients.has(clientId)) m.clients.set(clientId, { referenceData: { getSymbolsByTicker: m.lookup } })
    return m.clients.get(clientId)
} }))
import { publicSymbolReference } from "../snaptrade-symbol-reference"
const payload = (symbol: string) => ({ data: { symbol, id: "SECRET-ID", clientId: "SECRET-CLIENT", userSecret: "SECRET-USER",
    currency: { code: "USD", id: "SECRET-CURRENCY" }, type: { code: symbol === "AAPL" ? "cs" : "et" },
    exchange: { code: symbol === "AAPL" ? "NASDAQ" : "NYSE", mic_code: symbol === "AAPL" ? "XNAS" : "XNYS", id: "SECRET-EXCHANGE" } } })
beforeEach(() => {
    vi.resetAllMocks(); m.clients.clear(); vi.useFakeTimers(); m.namespace.mockReturnValue("next")
    m.lookup.mockImplementation(async ({ query }) => payload(query))
})
afterEach(() => vi.useRealTimers())
it("selects only the verified owner key and fixed symbols, returning an explicit public allowlist", async () => {
    const result = await publicSymbolReference("owned-next")
    expect(m.namespace).toHaveBeenCalledWith("owned-next"); expect(m.selected).toHaveBeenCalledWith("owned-next")
    expect(m.lookup.mock.calls).toEqual([[{ query: "AAPL" }, { timeout: 3000 }], [{ query: "SPY" }, { timeout: 3000 }]])
    expect(result).toEqual([{ symbol: "AAPL", currency: "USD", type: "cs", exchange: "NASDAQ", mic: "XNAS" },
        { symbol: "SPY", currency: "USD", type: "et", exchange: "NYSE", mic: "XNYS" }])
    expect(JSON.stringify(result)).not.toMatch(/SECRET|owned-next|clientId|userSecret|"id"/)
})
it("coalesces concurrent reads, caches only public metadata up to one hour, isolates credentials", async () => {
    await Promise.all([publicSymbolReference("owned-next"), publicSymbolReference("owned-next")])
    expect(m.lookup).toHaveBeenCalledTimes(2)
    await publicSymbolReference("owned-next"); expect(m.lookup).toHaveBeenCalledTimes(2)
    await publicSymbolReference("owned-original"); expect(m.lookup).toHaveBeenCalledTimes(4)
    vi.advanceTimersByTime(3600000); await publicSymbolReference("owned-next"); expect(m.lookup).toHaveBeenCalledTimes(6)
})
it("caches upstream failure without exposing an error or retrying on each open", async () => {
    m.lookup.mockRejectedValue(new Error("SECRET SIGNED URL"))
    expect(await publicSymbolReference("owned-next")).toBeNull()
    expect(await publicSymbolReference("owned-next")).toBeNull(); expect(m.lookup).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(3600000); await publicSymbolReference("owned-next"); expect(m.lookup).toHaveBeenCalledTimes(4)
})
it.each(["symbol", "currency", "type", "exchange", "mic"])("rejects malformed %s without leaking raw fields", async field => {
    m.lookup.mockImplementation(async ({ query }) => {
        const p: any = payload(query)
        if (field === "symbol") p.data.symbol = "OTHER"
        if (field === "currency") p.data.currency.code = "USD SECRET"
        if (field === "type") p.data.type.code = "crypto"
        if (field === "exchange") p.data.exchange.code = "https://secret.invalid"
        if (field === "mic") p.data.exchange.mic_code = "SECRET"
        return p
    })
    expect(await publicSymbolReference("owned-next")).toBeNull()
})
it("accepts missing optional MIC but never invents an exchange alias", async () => {
    m.lookup.mockImplementation(async ({ query }) => { const p: any = payload(query); p.data.exchange.mic_code = null; return p })
    expect((await publicSymbolReference("owned-next"))?.[0]).toMatchObject({ exchange: "NASDAQ", mic: null })
})
it("does not use a fallback key after ownership/config validation fails", async () => {
    m.namespace.mockImplementation(() => { throw new Error("SECRET CONFIG") })
    expect(await publicSymbolReference("unknown")).toBeNull(); expect(m.selected).not.toHaveBeenCalled(); expect(m.lookup).not.toHaveBeenCalled()
})
