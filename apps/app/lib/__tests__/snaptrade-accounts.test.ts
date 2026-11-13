import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
    list: vi.fn(), holdings: vi.fn(), retiredHoldings: vi.fn(), balances: vi.fn(),
}))
vi.mock("@/lib/snaptrade", () => ({
    isSnapTradeConfigured: true,
    clearLegacySnapTradeCookie: vi.fn(),
    getSnapTrade: () => ({ accountInformation: {
        listUserAccounts: mocks.list,
        getAllAccountPositions: mocks.holdings,
        getUserHoldings: mocks.retiredHoldings,
        getUserAccountBalance: mocks.balances,
    } }),
    snapTradeErrorMessage: (_error: unknown, fallback: string) => fallback,
}))
vi.mock("@/lib/snaptrade-access", () => ({ brokerageLimitError: async () => null, brokerageReadScope: async () => ({ countedConnectionId: null }), wantsCountedScope: () => false }))
vi.mock("@/lib/supabase-auth", () => ({ verifiedAppUserId: async () => "user" }))
vi.mock("@/lib/snaptrade-session", () => ({
    loadSession: async () => ({ userId: "broker-user", userSecret: "test-secret", clientId: "legacy-test" }),
}))
import { GET } from "../../app/api/snaptrade/accounts/route"

const account = (id: string, currency: string | undefined, amount: number | null) => ({
    id, name: id, balance: { total: { currency, amount } },
})
const request = () => GET(new NextRequest("https://example.test/api/snaptrade/accounts?positions=v2"))

beforeEach(() => {
    vi.resetAllMocks()
    mocks.holdings.mockResolvedValue({ data: { results: [] } })
    mocks.retiredHoldings.mockRejectedValue(Object.assign(new Error("This endpoint is no longer available for your account."), { status: 410 }))
    mocks.balances.mockResolvedValue({ data: [{ currency: { code: "USD" }, cash: 5 }] })
})
afterEach(() => { expect(mocks.retiredHoldings).not.toHaveBeenCalled() })

describe("brokerage account valuation", () => {
    it("preserves complete same-currency balances and a genuinely empty portfolio", async () => {
        mocks.list.mockResolvedValue({ data: [account("one", "USD", 100), account("two", "USD", 50)] })
        const response = await request()
        expect(response.status).toBe(200)
        const body = await response.json()
        expect(body.totalValue).toBe(150)
        expect(body.currency).toBe("USD")
        expect(body.positions).toEqual([])
        expect(body.accounts.map((a: any) => a.cash)).toEqual([5, 5])
    })
    it("does not report a failed holdings read as an empty account", async () => {
        mocks.list.mockResolvedValue({ data: [account("one", "USD", 100), account("two", "USD", 50)] })
        mocks.holdings.mockImplementation(async ({ accountId }: { accountId: string }) => {
            if (accountId === "two") throw new Error("rate limited")
            return { data: { results: [] } }
        })
        const response = await request()
        expect(response.status).toBe(502)
        const body = await response.json()
        expect(body.error).toContain("two")
        expect(body).not.toHaveProperty("positions")
        expect(body).not.toHaveProperty("totalValue")
    })
    it("never substitutes cash in a different currency", async () => {
        mocks.list.mockResolvedValue({ data: [account("canadian", "CAD", 100)] })
        const body = await (await request()).json()
        expect(body.accounts[0].cash).toBeNull()
        expect(body.totalValue).toBe(100)
        expect(body.currency).toBe("CAD")
    })
    it("keeps individual balances but omits a mixed-currency total", async () => {
        mocks.list.mockResolvedValue({ data: [account("one", "USD", 100), account("two", "CAD", 50)] })
        const body = await (await request()).json()
        expect(body.totalValue).toBeNull()
        expect(body.currency).toBeNull()
        expect(body.accounts.map((a: any) => a.totalValue)).toEqual([100, 50])
    })
    it("does not count a missing balance as zero", async () => {
        mocks.list.mockResolvedValue({ data: [account("one", "USD", 100), account("two", "USD", null)] })
        const body = await (await request()).json()
        expect(body.totalValue).toBeNull()
    })
    it("does not invent USD or choose a cash currency when account currency is unknown", async () => {
        mocks.list.mockResolvedValue({ data: [account("unknown", undefined, 100)] })
        const body = await (await request()).json()
        expect(body.currency).toBeNull()
        expect(body.totalValue).toBeNull()
        expect(body.accounts[0].currency).toBe("")
        expect(body.accounts[0].cash).toBeNull()
    })
})

it.each([{}, { results: null }, { results: [{ instrument: { kind: "stock", symbol: "AAPL" } }] }, { results: [{ instrument: { kind: "stock" }, units: "10oops" }] }, { results: [{ instrument: { kind: "stock" }, units: NaN }] }])("rejects incomplete holdings instead of inventing a zero position: %j", async (data) => {
    mocks.list.mockResolvedValue({ data: [account("one", "USD", 100)] })
    mocks.holdings.mockResolvedValue({ data })
    const response = await request()
    expect(response.status).toBe(502)
    expect(await response.json()).not.toHaveProperty("positions")
})
it("preserves legitimate zero and negative units and keeps invalid optional values unknown", async () => {
    mocks.list.mockResolvedValue({ data: [account("one", "USD", 100)] })
    mocks.holdings.mockResolvedValue({ data: { results: [{ instrument: { kind: "stock" }, units: "0", price: "2", currency: "USD" }, { instrument: { kind: "stock" }, units: "-2", price: "3", currency: "USD" }, { instrument: { kind: "stock" }, units: "4", price: "oops", cost_basis: "invalid", currency: "USD" }] } })
    const body = await (await request()).json()
    expect(body.positions.map((p: any) => p.marketValue)).toEqual([0, -6, null])
    expect(body.positions[2]).toMatchObject({ price: null, openPnl: null, averagePurchasePrice: null })
})

it("uses current V2 decimal positions and retains listing currency and basis", async () => {
    mocks.list.mockResolvedValue({ data: [account("one", "CAD", 100)] })
    mocks.holdings.mockResolvedValue({ data: { results: [{ instrument: { kind: "etf", symbol: "SPY", description: "Fund" },
        units: "1.25", price: "20.50", cost_basis: "18.25", currency: "USD" }] } })
    const body = await (await request()).json()
    expect(body.positions[0]).toEqual({ instrumentKind:"etf",securityId:null,securityIdSource:null,assetType:"etf", accountId: "one", symbol: "SPY", description: "Fund", units: 1.25,
        price: 20.5, marketValue: 25.63, averagePurchasePrice: 18.25, openPnl: null, currency: "USD", cashEquivalent: false, valuationSupported: true })
    expect(mocks.holdings).toHaveBeenCalledWith({ accountId: "one", userId: "broker-user", userSecret: "test-secret" })
})

it("does not count cash equivalents and cash-kind balances again as securities", async () => {
    mocks.list.mockResolvedValue({ data: [account("one", "USD", 100)] })
    mocks.holdings.mockResolvedValue({ data: { results: [
        { instrument: { kind: "mutualfund", symbol: "MONEY" }, cash_equivalent: true, units: "50", price: "1", currency: "USD" },
        { instrument: { kind: "cash", symbol: "USD" }, units: "50", price: "1", currency: "USD" },
    ] } })
    const body = await (await request()).json()
    expect(body.totalValue).toBe(100)
    expect(body.positions.map((p: any) => [p.cashEquivalent, p.valuationSupported, p.marketValue])).toEqual([[true, false, null], [true, false, null]])
})

it("does not value derivatives using an equity multiplier or fabricate unavailable holdings", async () => {
    mocks.list.mockResolvedValue({ data: [account("one", "USD", 100)] })
    mocks.holdings.mockResolvedValue({ data: { results: [{ instrument: { kind: "option", symbol: "OPTION" },
        units: "2", price: "3", cost_basis: "100", currency: "USD" }] } })
    const body = await (await request()).json()
    expect(body.positions[0]).toMatchObject({ units: 2, price: 3, marketValue: null, averagePurchasePrice: null, valuationSupported: false })
    mocks.list.mockResolvedValue({ data: [{ ...account("one", "USD", 100), sync_status: { holdings: { holdings_unavailable: true } } }] })
    expect((await request()).status).toBe(502)
})

it("marks a unit-priced position with unknown currency ineligible for valuation", async () => {
    mocks.list.mockResolvedValue({ data: [account("one", "USD", 100)] })
    mocks.holdings.mockResolvedValue({ data: { results: [{ instrument: { kind: "stock", symbol: "AAPL" }, units: "1", price: "5", cost_basis: "4" }] } })
    const body = await (await request()).json()
    expect(body.positions[0]).toMatchObject({ currency: null, valuationSupported: false, marketValue: null, averagePurchasePrice: null })
})

it.each([
    { instrument: { kind: "stock" }, units: "1", price: "5", currency: "CAD" },
    { instrument: { kind: "stock" }, units: "1", price: "5" },
    { instrument: { kind: "option" }, units: "1", price: "5", currency: "USD" },
    { instrument: { kind: "mutualfund" }, cash_equivalent: true, units: "5", price: "1", currency: "USD" },
    { instrument: { kind: "cash" }, units: "5", price: "1", currency: "USD" },
])("requires V2 opt-in before legacy clients can misvalue a position: %j", async position => {
    mocks.list.mockResolvedValue({ data: [account("one", "USD", 100)] })
    mocks.holdings.mockResolvedValue({ data: { results: [position] } })
    for (const suffix of ["", "?positions=unexpected"]) {
        const res = await GET(new NextRequest("https://example.test/api/snaptrade/accounts" + suffix))
        expect(res.status).toBe(409)
        const body = await res.json()
        expect(body.code).toBe("brokerage_client_update_required")
        expect(body).not.toHaveProperty("positions"); expect(body).not.toHaveProperty("totalValue")
    }
    expect((await request()).status).toBe(200)
})
it("keeps legacy same-currency unit-priced portfolios compatible", async () => {
    mocks.list.mockResolvedValue({ data: [account("one", "USD", 100)] })
    mocks.holdings.mockResolvedValue({ data: { results: [{ instrument: { kind: "stock", symbol: "AAPL" }, units: "2", price: "5", currency: "USD" }] } })
    const res = await GET(new NextRequest("https://example.test/api/snaptrade/accounts"))
    expect(res.status).toBe(200)
    expect((await res.json()).positions[0].marketValue).toBe(10)
})
