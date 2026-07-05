import { NextResponse } from "next/server";
import { fetchRssFeed, interleaveBySource, type NewsArticle } from "@/lib/rss";

// General market news for the discover landing's News row.
//
// Sources are deliberately diverse: Finnhub's general feed skews heavily
// Reuters, so it's blended with several public RSS feeds (CNBC, MarketWatch,
// Seeking Alpha, Investing.com) and interleaved round-robin by source so no
// single outlet saturates the row. Every source is fetched best-effort — any
// that fails or blocks is simply skipped.

export const revalidate = 900;

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
const FINNHUB = "https://finnhub.io/api/v1";

const RSS_SOURCES: { name: string; url: string }[] = [
    { name: "CNBC", url: "https://www.cnbc.com/id/100003114/device/rss/rss.html" },
    { name: "MarketWatch", url: "https://feeds.content.dowjones.io/public/rss/mw_topstories" },
    { name: "Seeking Alpha", url: "https://seekingalpha.com/market_currents.xml" },
    { name: "Investing.com", url: "https://www.investing.com/rss/news.rss" },
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
            .slice(0, 10)
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

export async function GET() {
    const [finnhub, ...rss] = await Promise.all([
        fetchFinnhub(),
        ...RSS_SOURCES.map((s) => fetchRssFeed(s.name, s.url, revalidate)),
    ]);

    const articles = interleaveBySource([...rss, finnhub], 18);
    return NextResponse.json({ articles });
}
