import { NextRequest, NextResponse } from "next/server";
import {
    BROWSER_UA,
    fetchRssFeed,
    interleaveBySource,
    parseGoogleNewsItems,
    type NewsArticle,
} from "@/lib/rss";

// Per-symbol company news (Cash App "News" row on the stock detail).
//
// Finnhub /company-news skews heavily Reuters, so it's blended with Google
// News' per-ticker RSS (per-item real outlet names — Barron's, Insider,
// GuruFocus, etc.) and Yahoo Finance's symbol RSS, interleaved by feed. All
// sources are best-effort — a blocked feed just drops out.

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

async function fetchGoogleNews(symbol: string): Promise<NewsArticle[]> {
    try {
        const q = encodeURIComponent(`${symbol} stock`);
        const res = await fetch(
            `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`,
            {
                headers: { "User-Agent": BROWSER_UA, Accept: "application/rss+xml, application/xml, text/xml, */*" },
                next: { revalidate },
            },
        );
        if (!res.ok) return [];
        return parseGoogleNewsItems(await res.text(), 10);
    } catch {
        return [];
    }
}

export async function GET(request: NextRequest) {
    const symbol = new URL(request.url).searchParams.get("symbol")?.toUpperCase();
    if (!symbol) {
        return NextResponse.json({ error: "Symbol is required." }, { status: 400 });
    }

    const [finnhub, google, yahoo] = await Promise.all([
        fetchFinnhubCompanyNews(symbol),
        fetchGoogleNews(symbol),
        fetchRssFeed(
            "Yahoo Finance",
            `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(symbol)}`,
            revalidate,
        ),
    ]);

    const articles = interleaveBySource([google, yahoo, finnhub], 12);
    return NextResponse.json({ symbol, articles });
}
