import { describe, expect, it } from "vitest"
import { decodePortfolio, encodePortfolio, manualPortfolioAnalysis, researchSymbol, saveHolding, validateHolding, type ManualHolding } from "../manual-portfolio"
const a: ManualHolding = { symbol: "AAPL", shares: 10, averageCost: 100, currentPrice: 125, priceAsOf: "2026-11-10" }
const b: ManualHolding = { symbol: "MSFT", shares: 5, averageCost: 200, currentPrice: null, priceAsOf: null }
describe("manual USD holdings, without broker or quote data", () => {
    it("never treats an unpriced holding as zero or a complete valuation", () => {
        const r = manualPortfolioAnalysis([a, b])
        expect(r).toMatchObject({ cost: 2000, value: null, partialValue: 1250, gain: null, gainPercent: null, pricedCount: 1, complete: false, allocationBasis: "cost basis" })
        expect(r.allocations.map(x => x.weight)).toEqual([50, 50])
    })
    it("uses entered prices for valuation and returns, with entered-value allocation", () => {
        const r = manualPortfolioAnalysis([a, { ...b, currentPrice: 150, priceAsOf: "2026-11-09" }])
        expect(r).toMatchObject({ cost: 2000, value: 2000, gain: 0, gainPercent: 0, complete: true, allocationBasis: "entered value" })
        expect(r.rows.map(x => x.gain)).toEqual([250, -250])
        expect(r.allocations.map(x => x.weight)).toEqual([62.5, 37.5])
    })
    it("handles a zero-price holding as a real loss and zero-basis percentages as unavailable", () => {
        expect(manualPortfolioAnalysis([{ ...a, currentPrice: 0 }]).gainPercent).toBe(-100)
        expect(manualPortfolioAnalysis([{ ...a, averageCost: 0 }]).gainPercent).toBeNull()
        expect(manualPortfolioAnalysis([{ ...a, averageCost: 0, currentPrice: null }]).allocations[0].weight).toBeNull()
    })
    it("an empty portfolio has no speculative valuation or return", () => {
        expect(manualPortfolioAnalysis([])).toMatchObject({ cost: 0, value: null, gain: null, complete: false, allocations: [] })
    })
    it("updates a holding snapshot instead of duplicating the same ticker or adding shares twice", () => {
        const updated = saveHolding([a, b], { ...a, symbol: "NASDAQ:AAPL", shares: 12, averageCost: 110 })
        expect(updated).toHaveLength(2)
        expect(updated.find(x => x.symbol === "AAPL")?.shares).toBe(12)
        expect(manualPortfolioAnalysis(updated).cost).toBe(2320)
    })
    it("rounds position values to cents before adding fractional-share totals", () => {
        expect(manualPortfolioAnalysis([{ ...a, shares: .3, averageCost: .1, currentPrice: .2 }])).toMatchObject({ cost: .03, value: .06, gain: .03 })
    })
    it.each([
        { shares: -1 }, { shares: 0 }, { shares: Infinity }, { shares: .0000001 },
        { averageCost: NaN }, { averageCost: -1 }, { shares: 1e9, averageCost: 100 },
        { currentPrice: NaN }, { currentPrice: -1 }, { currentPrice: 1e20 },
        { priceAsOf: "2026-02-30" }, { priceAsOf: "2026-99-99" }, { priceAsOf: null }, { symbol: "https://evil.test" },
    ])("rejects invalid saved or entered financial data %j", input => expect(() => validateHolding({ ...a, ...input })).toThrow())
    it("round-trips legitimate holdings, retaining dates and missing prices", () => expect(decodePortfolio(encodePortfolio([a, b]))).toEqual([a, b]))
    it.each(['{"version":2,"holdings":[]}', '{"version":1,"holdings":[{}]}', 'not json', JSON.stringify({ version: 1, holdings: [a, a] })])("rejects malformed or ambiguous persisted data", raw => expect(() => decodePortfolio(raw)).toThrow())
    it("does not expose raw external values as research URLs", () => {
        expect(researchSymbol(" nyse:brk.b ")).toBe("NYSE:BRK.B")
        for (const symbol of ['AAPL/orders', '<script>', 'https://example.test', 'NASDAQ:AAPL?next=evil']) expect(researchSymbol(symbol)).toBeNull()
    })
})
