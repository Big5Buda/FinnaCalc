import { expect, it, vi } from "vitest"
const api = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock("@/lib/api-client", () => ({ apiGet: api.get }))
import { widgetConfiguration, widgetSymbol, researchHref, TRADINGVIEW_SCRIPTS } from "../tradingview"
import { candles, financials, marketNews, marketOverview, marketStats, searchSymbols, stockDetail, sparklines, screener, statements, symbolNews } from "../investing/market"

it("keeps explicit exchange symbols and dotted tickers intact", () => {
    expect(widgetSymbol("AAPL")).toBe("NASDAQ:AAPL")
    expect(widgetSymbol("BRK.B")).toBe("NYSE:BRK.B")
    expect(widgetSymbol("NYSE:JPM")).toBe("NYSE:JPM")
    expect(researchHref("NYSE:BRK.B")).toBe("/investing/stocks/NYSE%3ABRK.B")
    expect(() => widgetSymbol("AAPL/../../account")).toThrow()
})
it("configures official displays without allowing chart symbol changes to mismatch the holding action", () => {
    expect(widgetConfiguration("chart", true, "AAPL")).toMatchObject({ symbol: "NASDAQ:AAPL", theme: "dark", allow_symbol_change: false })
    expect(widgetConfiguration("chart", false, "AAPL")).toMatchObject({ theme: "light" })
    for (const file of Object.values(TRADINGVIEW_SCRIPTS)) expect(file).toMatch(/^embed-widget-[a-z-]+\.js$/)
})
it("the website never calls the shared Alpaca-backed APIs in TradingView mode", async () => {
    const requests = [marketOverview(), marketStats(["AAPL"]), stockDetail("AAPL"), candles("AAPL", "1D"), searchSymbols("Apple"), sparklines(["AAPL"]), screener(), marketNews(), symbolNews("AAPL"), financials("AAPL"), statements("AAPL")]
    for (const request of requests) await expect(request).rejects.toThrow("TradingView")
    expect(api.get).not.toHaveBeenCalled()
})
