import { NextResponse } from "next/server"

export const revalidate = 300

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY
const BASE_URL = "https://finnhub.io/api/v1"

export interface NewsItem {
    id: number
    headline: string
    summary: string
    source: string
    url: string
    image: string
    datetime: number // unix seconds
    related: string
}

export async function GET() {
    if (!FINNHUB_API_KEY) {
        return NextResponse.json({ error: "Finnhub API key not configured." }, { status: 500 })
    }
    try {
        const res = await fetch(`${BASE_URL}/news?category=general&token=${FINNHUB_API_KEY}`, {
            next: { revalidate: 300 },
        })
        if (!res.ok) throw new Error(`Finnhub error: ${res.status}`)
        const data = await res.json()
        const items: NewsItem[] = (Array.isArray(data) ? data : [])
            .filter((n: any) => n.headline && n.url)
            .slice(0, 24)
            .map((n: any) => ({
                id: n.id,
                headline: n.headline,
                summary: n.summary || "",
                source: n.source || "",
                url: n.url,
                image: n.image || "",
                datetime: n.datetime || 0,
                related: n.related || "",
            }))
        return NextResponse.json({ items })
    } catch (err: any) {
        return NextResponse.json({ error: err.message || "Failed to fetch news." }, { status: 500 })
    }
}
