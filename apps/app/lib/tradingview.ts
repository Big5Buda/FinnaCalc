import { researchSymbol } from "./manual-portfolio"

export const TRADINGVIEW_SCRIPTS = {
    overview: "embed-widget-market-overview.js",
    chart: "embed-widget-advanced-chart.js",
    info: "embed-widget-symbol-info.js",
    profile: "embed-widget-symbol-profile.js",
    financials: "embed-widget-financials.js",
    screener: "embed-widget-screener.js",
    news: "embed-widget-timeline.js",
} as const
export type WidgetKind = keyof typeof TRADINGVIEW_SCRIPTS
const EXCHANGES: Record<string, string> = {
    AAPL: "NASDAQ", MSFT: "NASDAQ", NVDA: "NASDAQ", AMZN: "NASDAQ", GOOGL: "NASDAQ", GOOG: "NASDAQ", META: "NASDAQ", TSLA: "NASDAQ", QQQ: "NASDAQ",
    SPY: "AMEX", DIA: "AMEX", IWM: "AMEX", VTI: "AMEX", VOO: "AMEX", XLK: "AMEX", XLV: "AMEX", XLF: "AMEX", XLY: "AMEX", XLE: "AMEX", XLC: "AMEX", XLI: "AMEX",
    "BRK.B": "NYSE", JPM: "NYSE", V: "NYSE", UNH: "NYSE", LLY: "NYSE", WMT: "NASDAQ",
}
export function widgetSymbol(input: string) {
    const symbol = researchSymbol(input)
    if (!symbol) throw new Error("Enter a valid ticker.")
    return symbol.includes(":") || !EXCHANGES[symbol] ? symbol : `${EXCHANGES[symbol]}:${symbol}`
}
export function researchHref(symbol: string) {
    const valid = researchSymbol(symbol)
    if (!valid) throw new Error("Enter a valid ticker.")
    return `/investing/stocks/${encodeURIComponent(valid)}`
}
export function widgetConfiguration(kind: WidgetKind, dark: boolean, symbol = "AAPL", researchUrl = "") {
    const color = dark ? "dark" : "light"
    const base = { width: "100%", height: "100%", locale: "en", colorTheme: color, isTransparent: false }
    switch (kind) {
        case "chart": return { autosize: true, symbol: widgetSymbol(symbol), interval: "D", timezone: "Etc/UTC", theme: color,
            style: "1", locale: "en", allow_symbol_change: false, calendar: false, support_host: "https://www.tradingview.com" }
        case "info": case "profile": case "financials": return { ...base, symbol: widgetSymbol(symbol), displayMode: "adaptive" }
        case "news": return { ...base, feedMode: "all_symbols", displayMode: "regular" }
        case "screener": return { ...base, market: "america", showToolbar: true, defaultColumn: "overview", defaultScreen: "most_capitalized", largeChartUrl: researchUrl }
        case "overview": return { ...base, dateRange: "12M", showChart: true, showSymbolLogo: true,
            showFloatingTooltip: true, largeChartUrl: researchUrl,
            tabs: [
                { title: "Market", symbols: [{ s: "AMEX:SPY", d: "S&P 500 ETF" }, { s: "NASDAQ:QQQ", d: "Nasdaq 100 ETF" }, { s: "AMEX:DIA", d: "Dow ETF" }, { s: "AMEX:IWM", d: "Russell 2000 ETF" }] },
                { title: "Stocks", symbols: ["NASDAQ:AAPL", "NASDAQ:MSFT", "NASDAQ:NVDA", "NASDAQ:AMZN", "NASDAQ:GOOGL", "NASDAQ:META", "NYSE:BRK.B"].map(s => ({ s })) },
            ] }
    }
}
