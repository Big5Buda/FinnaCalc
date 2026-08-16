import { NextRequest, NextResponse } from "next/server";
import { news as alpacaNews } from "@/lib/alpaca";
import {
    BROWSER_UA,
    decodeEntities,
    faviconFor,
    fetchRssFeed,
    interleaveBySource,
    parseGoogleNewsItems,
    type NewsArticle,
} from "@/lib/rss";

// Per-symbol company news.
//
// Alpaca's news API (Benzinga-sourced) replaces the Finnhub feed this used to
// blend. It's still blended with Google News' per-ticker RSS and Yahoo
// Finance's symbol RSS — public feeds, no vendor key — because any single
// source skews toward its own wire, and interleaving keeps one outlet from
// saturating the row. Every source is best-effort: a blocked feed just drops
// out.

export const revalidate = 900;

async function fetchAlpaca(symbol: string): Promise<NewsArticle[]> {
    const items = await alpacaNews({ symbols: [symbol], limit: 10 }, revalidate);
    return items
        .filter((item) => item.headline && item.url)
        .map((item) => ({
            id: String(item.id ?? item.url),
            headline: decodeEntities(item.headline),
            source: item.source || "Alpaca",
            url: item.url,
            image: faviconFor(item.url) || (item.images?.[0]?.url ?? ""),
            datetime: Number.isFinite(Date.parse(item.created_at))
                ? Math.round(Date.parse(item.created_at) / 1000)
                : null,
            summary: decodeEntities(item.summary ?? ""),
        }));
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

    const [alpaca, google, yahoo] = await Promise.all([
        fetchAlpaca(symbol),
        fetchGoogleNews(symbol),
        fetchRssFeed(
            "Yahoo Finance",
            `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(symbol)}`,
            revalidate,
        ),
    ]);

    const articles = interleaveBySource([alpaca, google, yahoo], 12);
    return NextResponse.json({ symbol, articles });
}
