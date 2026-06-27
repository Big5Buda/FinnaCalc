import { NextResponse } from "next/server"

export const revalidate = 600

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY
const BASE_URL = "https://finnhub.io/api/v1"

// Curated universe kept small to stay within the Finnhub free-tier rate limit
// (each symbol needs quote + profile + metric). Cached for 10 minutes.
const UNIVERSE = [
    { symbol: "AAPL", sector: "Technology" },
    { symbol: "MSFT", sector: "Technology" },
    { symbol: "NVDA", sector: "Technology" },
    { symbol: "GOOGL", sector: "Communication" },
    { symbol: "META", sector: "Communication" },
    { symbol: "AMZN", sector: "Consumer" },
    { symbol: "TSLA", sector: "Consumer" },
    { symbol: "JPM", sector: "Financials" },
    { symbol: "V", sector: "Financials" },
    { symbol: "UNH", sector: "Healthcare" },
    { symbol: "JNJ", sector: "Healthcare" },
    { symbol: "XOM", sector: "Energy" },
]

export interface ScreenerRow {
    symbol: string
    company: string
    sector: string
    price: number
    changePercent: number
    marketCap: number | null // in USD
    peRatio: number | null
    dividendYield: number | null // %
}

async function fhSafe(path: string): Promise<any | null> {
    try {
        const res = await fetch(`${BASE_URL}${path}&token=${FINNHUB_API_KEY}`, { next: { revalidate: 600 } })
        if (!res.ok) return null
        return await res.json()
    } catch {
        return null
    }
}

export async function GET() {
    if (!FINNHUB_API_KEY) {
        return NextResponse.json({ error: "Finnhub API key not configured." }, { status: 500 })
    }
    try {
        const rows = await Promise.all(
            UNIVERSE.map(async ({ symbol, sector }) => {
                const [quote, profile, metric] = await Promise.all([
                    fhSafe(`/quote?symbol=${symbol}`),
                    fhSafe(`/stock/profile2?symbol=${symbol}`),
                    fhSafe(`/stock/metric?symbol=${symbol}&metric=all`),
                ])
                if (!quote || !quote.c) return null
                const m = metric?.metric ?? {}
                const marketCap = profile?.marketCapitalization
                    ? Math.round(profile.marketCapitalization * 1_000_000)
                    : null
                const dy = m.currentDividendYieldTTM ?? m.dividendYieldIndicatedAnnual ?? null
                return {
                    symbol,
                    company: profile?.name || symbol,
                    sector,
                    price: quote.c,
                    changePercent: quote.dp ?? 0,
                    marketCap,
                    peRatio: m.peTTM != null ? Math.round(m.peTTM * 100) / 100 : null,
                    dividendYield: dy != null ? Math.round(dy * 100) / 100 : null,
                } as ScreenerRow
            })
        )
        return NextResponse.json({ rows: rows.filter(Boolean) })
    } catch (err: any) {
        return NextResponse.json({ error: err.message || "Failed to run screener." }, { status: 500 })
    }
}
