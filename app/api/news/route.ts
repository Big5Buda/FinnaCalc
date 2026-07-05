import { NextRequest, NextResponse } from "next/server";
import { fetchRssFeed, interleaveBySource, type NewsArticle } from "@/lib/rss";

// Per-symbol company news (Cash App "News" row on the stock detail).
//
// Finnhub /company-news skews heavily Reuters, so it's blended with Yahoo
// Finance's per-symbol RSS (which aggregates Motley Fool, Barron's, Insider,
// etc.) and interleaved by source. Both sources are best-effort.

export const revalidate = 900;

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
const FINNHUB = "https://finnhub.io/api/v1";

function ymd(d: Date): string {
    return d.toISOString().slice(0, 10);
}

async function fetchFinnhubCompanyNews(symbol: string): Promise<NewsArticle[]> {
    if (!FINNHUB_API_KEY) return [];
    const to = new Date();
    const from = new Date(to.getTime() - 14 * 24 * 60 * 60 * 1000);
    try {
        const res = await fetch(
            `${FINNHUB}/company-news?symbol=${symbol}&from=${ymd(from)}&to=${ymd(to)}&token=${FINNHUB_API_KEY}`,
            { next: { revalidate } },
        );
        if (!res.ok) return [];
        const raw = (await res.json()) as any[];
        return (Array.isArray(raw) ? raw : [])
            .filter((a) => a && a.headline && a.url)
            .slice(0, 8)
            .map((a) => ({
                id: String(a.id ?? a.url),
                headline: a.headline,
                source: a.source ?? "Finnhub",
                url: a.url,
                image: a.image ?? "",
                datetime: typeof a.datetime === "number" ? a.datetime : null,
                summary: a.summary ?? "",
            }));
    } catch {
        return [];
    }
}

export async function GET(request: NextRequest) {
    const symbol = new URL(request.url).searchParams.get("symbol")?.toUpperCase();
    if (!symbol) {
        return NextResponse.json({ error: "Symbol is required." }, { status: 400 });
    }

    const [finnhub, yahoo] = await Promise.all([
        fetchFinnhubCompanyNews(symbol),
        fetchRssFeed(
            "Yahoo Finance",
            `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(symbol)}`,
            revalidate,
        ),
    ]);

    const articles = interleaveBySource([yahoo, finnhub], 12);
    return NextResponse.json({ symbol, articles });
}
