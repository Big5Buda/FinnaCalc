/**
 * Typed reads of the market routes — the web twin of Core/Market/MarketService.
 * Every one of these is Alpaca-backed now (see lib/alpaca.ts), except the SEC
 * statements and the RSS-blended news.
 */

import { apiGet } from "@/lib/api-client"

export type MarketStat = { symbol: string; name: string | null; price: number; changePct: number }

export type MarketQuote = {
    symbol: string
    name: string
    sector: string
    sectorColor: string
    price: number
    change: number
    changesPercentage: number
    high: number
    low: number
    open: number
    previousClose: number
    logo: string
}

export type SectorSummary = {
    id: string
    name: string
    color: string
    avgChange: number
    stockCount: number
}

export type MarketOverview = {
    stocks: MarketQuote[]
    gainers: MarketQuote[]
    losers: MarketQuote[]
    mostActive: MarketQuote[]
    sectorSummary: SectorSummary[]
}

export type CandlePoint = { t: number; c: number; o?: number; h?: number; l?: number }

export type StockDetail = {
    quote: {
        "01. symbol": string
        "05. price": string
        "09. change": string
        "10. change percent": string
    }
    overview: {
        Name: string
        MarketCapitalization: string
        Description: string
        Logo: string
        PERatio: string
    }
    stats: {
        high52: number | null
        low52: number | null
        beta: number | null
        epsTTM: number | null
        dividendYield: number | null
        netMargin: number | null
        revenueGrowth: number | null
        grossMargin: number | null
        sharesOutstanding: number | null
    } | null
    company: {
        exchange: string | null
        industry: string | null
        sector: string | null
        ceo: string | null
        employees: string | null
        ipo: string | null
        website: string | null
        country: string | null
    } | null
}

export type NewsArticle = {
    id: string
    headline: string
    source: string
    url: string
    image: string
    datetime: number | null
    summary: string
}

export type SearchResult = { "1. symbol": string; "2. name": string; "4. region": string }

/** Mirrors app/api/screener's row: measured numbers only, no fundamentals. */
export type ScreenerRow = {
    symbol: string
    company: string
    exchange: string
    price: number
    change: number | null
    changePct: number | null
    volume: number | null
    avgVolume: number | null
    /** Today's volume over the recent session average; 1.0 is a typical day. */
    relVolume: number | null
    dayHigh: number | null
    dayLow: number | null
    prevClose: number | null
}

export type ScreenerPreset = "actives" | "gainers" | "losers"

export type FinancialPeriod = {
    year: number | null
    quarter: number | null
    revenue: number
    netProfit: number
}

/**
 * Every SEC-backed route reports whether an empty payload means "there is
 * nothing here" or "we couldn't find out". See lib/sec.ts — the distinction
 * exists because a rejected request used to render as a hidden section, which
 * reads as a fact about the company rather than a gap in what we know.
 *
 * Optional because shipped iOS builds predate it and older cached responses
 * won't carry it; absent is treated as "ok".
 */
export type SourceReport = {
    status?: "ok" | "no-data" | "unavailable"
    reason?: string | null
}

export type StatementsResponse = SourceReport & {
    symbol: string
    years: (number | string)[]
    statements: { name: string; rows: { label: string; values: (number | null)[] }[] }[]
}

export const marketStats = (symbols: string[]) =>
    apiGet<{ stats: MarketStat[] }>("/api/market-stats", { symbols: symbols.join(",") })

export const marketOverview = () => apiGet<MarketOverview>("/api/market-overview")

export const stockDetail = (symbol: string) => apiGet<StockDetail>("/api/stock", { symbol })

export const candles = (symbol: string, range: string, interval?: string) =>
    apiGet<{ symbol: string; range: string; points: CandlePoint[] }>("/api/candles", {
        symbol,
        range,
        ...(interval ? { interval } : {}),
    })

export const sparklines = (symbols: string[]) =>
    apiGet<{ sparklines: Record<string, number[]> }>("/api/sparklines", { symbols: symbols.join(",") })

export const searchSymbols = (keywords: string) =>
    apiGet<SearchResult[]>("/api/stock-search", { keywords })

export const marketNews = () => apiGet<{ articles: NewsArticle[] }>("/api/market-news")

export const symbolNews = (symbol: string) =>
    apiGet<{ symbol: string; articles: NewsArticle[] }>("/api/news", { symbol })

export const screener = (query: Record<string, string> = {}) =>
    apiGet<{
        rows: ScreenerRow[]
        preset?: ScreenerPreset
        universeSize?: number
        asOf?: string
        unsupported?: string[]
        error?: string
    }>("/api/screener", query)

export const financials = (symbol: string) =>
    apiGet<
        SourceReport & { symbol: string; annual: FinancialPeriod[]; quarterly: FinancialPeriod[] }
    >("/api/financials", { symbol })

export const statements = (symbol: string) =>
    apiGet<StatementsResponse>("/api/statements", { symbol })

/**
 * Company marks come from Brandfetch's ticker CDN — free, commercial use
 * allowed, no attribution asked. `fallback/404` is deliberate: a miss must 404
 * so the caller falls through to its monogram instead of showing a stranger's
 * mark. (Its predecessor hotlinked a vendor image CDN with no account, which
 * their terms forbid for commercial display; whatever replaces this must clear
 * the same bar.)
 */
const BRANDFETCH_CLIENT_ID = "1idsFuoxxIb4DvxlMNa"

export function tickerLogoURL(symbol: string, size = 128): string {
    const side = [64, 128, 256, 512].find((bucket) => bucket >= size * 2) ?? 512
    return `https://cdn.brandfetch.io/ticker/${encodeURIComponent(
        symbol.toUpperCase()
    )}/w/${side}/h/${side}/fallback/404?c=${BRANDFETCH_CLIENT_ID}`
}
