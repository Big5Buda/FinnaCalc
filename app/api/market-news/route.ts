import { NextResponse } from "next/server";
import { decodeEntities, faviconFor, fetchRssFeed, interleaveBySource, type NewsArticle } from "@/lib/rss";

// General market news for the discover landing's News row and its "View more"
// list.
//
// Sources are deliberately diverse: Finnhub's general feed skews heavily
// Reuters, so it's blended with several public RSS feeds (CNBC, MarketWatch,
// Seeking Alpha, Investing.com, Yahoo Finance, NPR Business) and interleaved
// round-robin by source so no single outlet saturates the row. Every source is
// fetched best-effort — any that fails or blocks is simply skipped.
//
// The cap is generous because the app now has somewhere to put the tail: the
// row shows the first handful and "View more" opens the lot with a search box
// over them. Raising it costs nothing per request — the same feeds are already
// being fetched and parsed in full, and the answer is cached for 15 minutes.

export const revalidate = 900;

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
const FINNHUB = "https://finnhub.io/api/v1";

const RSS_SOURCES: { name: string; url: string }[] = [
    { name: "CNBC", url: "https://www.cnbc.com/id/100003114/device/rss/rss.html" },
    { name: "MarketWatch", url: "https://feeds.content.dowjones.io/public/rss/mw_topstories" },
    { name: "Seeking Alpha", url: "https://seekingalpha.com/market_currents.xml" },
    { name: "Investing.com", url: "https://www.investing.com/rss/news.rss" },
    { name: "Yahoo Finance", url: "https://finance.yahoo.com/news/rssindex" },
    { name: "NPR Business", url: "https://feeds.npr.org/1006/rss.xml" },
];

async function fetchFinnhub(): Promise<NewsArticle[]> {
    if (!FINNHUB_API_KEY) return [];
    try {
        const res = await fetch(`${FINNHUB}/news?category=general&token=${FINNHUB_API_KEY}`, {
            next: { revalidate },
        });
        if (!res.ok) return [];
        const raw = (await res.json()) as any[];
        return (Array.isArray(raw) ? raw : [])
            .filter((a) => a && a.headline && a.url)
            .slice(0, 30)
            .map((a) => ({
                id: String(a.id ?? a.url),
                headline: decodeEntities(a.headline),
                source: a.source ?? "Finnhub",
                url: a.url,
                image: faviconFor(a.url) || (a.image ?? ""),
                datetime: typeof a.datetime === "number" ? a.datetime : null,
                summary: decodeEntities(a.summary ?? ""),
            }));
    } catch {
        return [];
    }
}

export async function GET() {
    const [finnhub, ...rss] = await Promise.all([
        fetchFinnhub(),
        ...RSS_SOURCES.map((s) => fetchRssFeed(s.name, s.url, revalidate)),
    ]);

    const articles = interleaveBySource([...rss, finnhub], 90);
    return NextResponse.json({ articles });
}
