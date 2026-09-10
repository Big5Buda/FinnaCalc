import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
    list: vi.fn(), holdings: vi.fn(), balances: vi.fn(),
}))
vi.mock("@/lib/snaptrade", () => ({
    isSnapTradeConfigured: true,
    clearLegacySnapTradeCookie: vi.fn(),
    getSnapTrade: () => ({ accountInformation: {
        listUserAccounts: mocks.list,
        getUserHoldings: mocks.holdings,
        getUserAccountBalance: mocks.balances,
    } }),
    snapTradeErrorMessage: (_error: unknown, fallback: string) => fallback,
}))
vi.mock("@/lib/snaptrade-access", () => ({ brokerageLimitError: async () => null }))
vi.mock("@/lib/supabase-auth", () => ({ verifiedAppUserId: async () => "user" }))
vi.mock("@/lib/snaptrade-session", () => ({
    loadSession: async () => ({ userId: "broker-user", userSecret: "test-secret" }),
}))
import { GET } from "../../app/api/snaptrade/accounts/route"

const account = (id: string, currency: string | undefined, amount: number | null) => ({
    id, name: id, balance: { total: { currency, amount } },
})
const request = () => GET(new NextRequest("https://example.test/api/snaptrade/accounts"))

beforeEach(() => {
    vi.resetAllMocks()
    mocks.holdings.mockResolvedValue({ data: { positions: [] } })
    mocks.balances.mockResolvedValue({ data: [{ currency: { code: "USD" }, cash: 5 }] })
})

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
            return { data: { positions: [] } }
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

it.each([{}, { positions: null }, { positions: [{ symbol: "AAPL" }] }, { positions: [{ units: "10" }] }, { positions: [{ units: NaN }] }])("rejects incomplete holdings instead of inventing a zero position: %j", async (data) => {
    mocks.list.mockResolvedValue({ data: [account("one", "USD", 100)] })
    mocks.holdings.mockResolvedValue({ data })
    const response = await request()
    expect(response.status).toBe(502)
    expect(await response.json()).not.toHaveProperty("positions")
})
it("preserves legitimate zero and negative units and keeps invalid optional values unknown", async () => {
    mocks.list.mockResolvedValue({ data: [account("one", "USD", 100)] })
    mocks.holdings.mockResolvedValue({ data: { positions: [{ units: 0, price: 2 }, { units: -2, price: 3 }, { units: 4, price: "5", open_pnl: "6", average_purchase_price: "7" }] } })
    const body = await (await request()).json()
    expect(body.positions.map((p: any) => p.marketValue)).toEqual([0, -6, null])
    expect(body.positions[2]).toMatchObject({ price: null, openPnl: null, averagePurchasePrice: null })
})
