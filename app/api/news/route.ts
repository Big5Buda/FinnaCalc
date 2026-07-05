import { NextRequest, NextResponse } from "next/server";

// Per-symbol company news (Cash App "News" row). Finnhub /company-news is
// free-tier; it needs a from/to date window (we use the last 14 days).

export const revalidate = 900;

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
const BASE_URL = "https://finnhub.io/api/v1";

function ymd(d: Date): string {
    return d.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
    if (!FINNHUB_API_KEY) {
        return NextResponse.json({ error: "Finnhub API key not configured." }, { status: 500 });
    }
    const symbol = new URL(request.url).searchParams.get("symbol")?.toUpperCase();
    if (!symbol) {
        return NextResponse.json({ error: "Symbol is required." }, { status: 400 });
    }

    const to = new Date();
    const from = new Date(to.getTime() - 14 * 24 * 60 * 60 * 1000);

    try {
        const res = await fetch(
            `${BASE_URL}/company-news?symbol=${symbol}&from=${ymd(from)}&to=${ymd(to)}&token=${FINNHUB_API_KEY}`,
            { next: { revalidate } },
        );
        if (!res.ok) {
            return NextResponse.json({ symbol, articles: [] });
        }
        const raw = (await res.json()) as any[];

        const articles = (Array.isArray(raw) ? raw : [])
            .filter((a) => a && a.headline && a.url)
            .slice(0, 12)
            .map((a) => ({
                id: String(a.id ?? a.url),
                headline: a.headline,
                source: a.source ?? "",
                url: a.url,
                image: a.image ?? "",
                datetime: typeof a.datetime === "number" ? a.datetime : null,
                summary: a.summary ?? "",
            }));

        return NextResponse.json({ symbol, articles });
    } catch (err: any) {
        return NextResponse.json({ symbol, articles: [] });
    }
}
