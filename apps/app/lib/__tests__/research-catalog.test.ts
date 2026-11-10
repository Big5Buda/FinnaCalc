import { describe, expect, it } from "vitest"
import { searchResearch, resolveResearch, sectorStocks, holdingSector, RESEARCH_CATALOG } from "../investing/research-catalog"
import { portfolioInsights } from "../manual-portfolio-insights"
import { SECTORS } from "../investing/catalog"
const h = (symbol: string, currentPrice: number | null, averageCost = 100) => ({ symbol, shares: 10, averageCost, currentPrice, priceAsOf: currentPrice === null ? null : "2026-11-10" })
describe("public research discovery", () => {
    it("resolves company names, partial names, tickers and explicit exchanges", () => {
        expect(resolveResearch("Apple")).toBe("AAPL")
        expect(resolveResearch("microsoft")).toBe("MSFT")
        expect(resolveResearch("aapl")).toBe("AAPL")
        expect(resolveResearch("NASDAQ:AAPL")).toBe("NASDAQ:AAPL")
        expect(resolveResearch("New company name")).toBeNull()
        expect(resolveResearch("<script>")).toBeNull()
    })
    it("shows choices for ambiguous names instead of opening a nonexistent ticker", () => {
        expect(searchResearch("Alphabet").map(e => e.symbol)).toEqual(["GOOG", "GOOGL"])
        expect(resolveResearch("Alphabet")).toBeNull()
        expect(searchResearch("AAPL")[0].symbol).toBe("AAPL")
    })
    it("has real stock choices for every sector and unique entries", () => {
        for (const sector of SECTORS) expect(sectorStocks(sector.id).length).toBeGreaterThan(5)
        expect(new Set(RESEARCH_CATALOG.map(e => e.symbol)).size).toBe(RESEARCH_CATALOG.length)
        expect(holdingSector("META").id).toBe("communication")
        expect(holdingSector("VOO").name).toBe("Funds / ETFs")
        expect(holdingSector("ZZZZ").name).toBe("Unclassified")
    })
})
describe("manual portfolio insights", () => {
    it("computes honest position returns, aggregate return and sector weights", () => {
        const r = portfolioInsights([h("AAPL",125), h("JPM",75)])
        expect(r.value).toBe(2000); expect(r.gain).toBe(0); expect(r.gainPercent).toBe(0)
        expect(r.rows.map(h => h.gainPercent)).toEqual([25,-25])
        expect(r.sectors.map(s => s.weight)).toEqual([62.5,37.5])
        expect(r.winners).toBe(1); expect(r.losers).toBe(1)
    })
    it("uses cost allocation for partial pricing without fabricating total return", () => {
        const r=portfolioInsights([h("AAPL",125), h("ZZZZ",null)])
        expect(r.gainPercent).toBeNull(); expect(r.value).toBeNull()
        expect(r.rows[1].gainPercent).toBeNull()
        expect(r.allocationBasis).toBe("cost basis")
        expect(r.sectors.map(s => s.weight)).toEqual([50,50])
    })
    it("handles zero basis and empty portfolios without invalid chart values", () => {
        expect(portfolioInsights([h("AAPL",100,0)]).rows[0].gainPercent).toBeNull()
        const zero=portfolioInsights([h("AAPL",null,0)])
        expect(zero.sectors[0].weight).toBeNull(); expect(zero.topThreeWeight).toBeNull()
        expect(portfolioInsights([]).sectors).toEqual([])
    })
    it("does not claim sector look-through for ETFs", () => {
        expect(portfolioInsights([h("VOO",120)]).sectors[0].name).toBe("Funds / ETFs")
    })
})
