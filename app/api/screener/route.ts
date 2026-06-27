import { NextResponse } from "next/server"

export const revalidate = 600

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY
const BASE_URL = "https://finnhub.io/api/v1"

// Curated universe (name + sector hardcoded so we only need 2 API calls each:
// quote + metric). Well within the Finnhub free-tier rate limit, cached 10m.
const UNIVERSE: { symbol: string; name: string; sector: string }[] = [
    { symbol: "AAPL", name: "Apple Inc.", sector: "Technology" },
    { symbol: "MSFT", name: "Microsoft Corp.", sector: "Technology" },
    { symbol: "NVDA", name: "NVIDIA Corp.", sector: "Technology" },
    { symbol: "AMD", name: "Advanced Micro Devices", sector: "Technology" },
    { symbol: "ORCL", name: "Oracle Corp.", sector: "Technology" },
    { symbol: "GOOGL", name: "Alphabet Inc.", sector: "Communication" },
    { symbol: "META", name: "Meta Platforms Inc.", sector: "Communication" },
    { symbol: "NFLX", name: "Netflix Inc.", sector: "Communication" },
    { symbol: "DIS", name: "Walt Disney Co.", sector: "Communication" },
    { symbol: "AMZN", name: "Amazon.com Inc.", sector: "Consumer" },
    { symbol: "TSLA", name: "Tesla Inc.", sector: "Consumer" },
    { symbol: "HD", name: "Home Depot Inc.", sector: "Consumer" },
    { symbol: "MCD", name: "McDonald's Corp.", sector: "Consumer" },
    { symbol: "JPM", name: "JPMorgan Chase & Co.", sector: "Financials" },
    { symbol: "BAC", name: "Bank of America Corp.", sector: "Financials" },
    { symbol: "V", name: "Visa Inc.", sector: "Financials" },
    { symbol: "MA", name: "Mastercard Inc.", sector: "Financials" },
    { symbol: "UNH", name: "UnitedHealth Group", sector: "Healthcare" },
    { symbol: "JNJ", name: "Johnson & Johnson", sector: "Healthcare" },
    { symbol: "LLY", name: "Eli Lilly and Co.", sector: "Healthcare" },
    { symbol: "PFE", name: "Pfizer Inc.", sector: "Healthcare" },
    { symbol: "XOM", name: "Exxon Mobil Corp.", sector: "Energy" },
    { symbol: "CVX", name: "Chevron Corp.", sector: "Energy" },
    { symbol: "CAT", name: "Caterpillar Inc.", sector: "Industrials" },
]

export interface ScreenerRow {
    symbol: string
    company: string
    sector: string
    price: number
    changePercent: number
    marketCap: number | null // USD
    peRatio: number | null
    dividendYield: number | null // %
    beta: number | null
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

function round(n: number, d = 2) {
    const f = 10 ** d
    return Math.round(n * f) / f
}

export async function GET() {
    if (!FINNHUB_API_KEY) {
        return NextResponse.json({ error: "Finnhub API key not configured." }, { status: 500 })
    }
    try {
        const rows = await Promise.all(
            UNIVERSE.map(async ({ symbol, name, sector }) => {
                const [quote, metric] = await Promise.all([
                    fhSafe(`/quote?symbol=${symbol}`),
                    fhSafe(`/stock/metric?symbol=${symbol}&metric=all`),
                ])
                if (!quote || !quote.c) return null
                const m = metric?.metric ?? {}
                const dy = m.currentDividendYieldTTM ?? m.dividendYieldIndicatedAnnual ?? null
                return {
                    symbol,
                    company: name,
                    sector,
                    price: round(quote.c),
                    changePercent: round(quote.dp ?? 0),
                    // metric.marketCapitalization is in millions
                    marketCap: m.marketCapitalization != null ? Math.round(m.marketCapitalization * 1_000_000) : null,
                    peRatio: m.peTTM != null ? round(m.peTTM) : null,
                    dividendYield: dy != null ? round(dy) : null,
                    beta: m.beta != null ? round(m.beta) : null,
                } as ScreenerRow
            })
        )
        return NextResponse.json({ rows: rows.filter(Boolean) })
    } catch (err: any) {
        return NextResponse.json({ error: err.message || "Failed to run screener." }, { status: 500 })
    }
}
