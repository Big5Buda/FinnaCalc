import { NextResponse } from "next/server"

export const revalidate = 3600

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY
const BASE_URL = "https://finnhub.io/api/v1"

export interface EarningsEvent {
    date: string
    symbol: string
    epsEstimate: number | null
    epsActual: number | null
    revenueEstimate: number | null
    hour: string // "bmo" | "amc" | "dmh" | ""
}

function fmtDate(d: Date) {
    return d.toISOString().split("T")[0]
}

export async function GET() {
    if (!FINNHUB_API_KEY) {
        return NextResponse.json({ error: "Finnhub API key not configured." }, { status: 500 })
    }
    try {
        const now = new Date()
        const to = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
        const res = await fetch(
            `${BASE_URL}/calendar/earnings?from=${fmtDate(now)}&to=${fmtDate(to)}&token=${FINNHUB_API_KEY}`,
            { next: { revalidate: 3600 } }
        )
        if (!res.ok) throw new Error(`Finnhub error: ${res.status}`)
        const data = await res.json()
        const events: EarningsEvent[] = (data?.earningsCalendar ?? [])
            .map((e: any) => ({
                date: e.date,
                symbol: e.symbol,
                epsEstimate: e.epsEstimate ?? null,
                epsActual: e.epsActual ?? null,
                revenueEstimate: e.revenueEstimate ?? null,
                hour: e.hour ?? "",
            }))
            .sort((a: EarningsEvent, b: EarningsEvent) => a.date.localeCompare(b.date))
            .slice(0, 25)
        return NextResponse.json({ events })
    } catch (err: any) {
        return NextResponse.json({ error: err.message || "Failed to fetch earnings calendar." }, { status: 500 })
    }
}
