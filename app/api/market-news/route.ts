import { NextResponse } from "next/server";
import { news as alpacaNews } from "@/lib/alpaca";
import { decodeEntities, faviconFor, fetchRssFeed, interleaveBySource, type NewsArticle } from "@/lib/rss";

// General market news for the discover landing's News row and its "View more"
// list.
//
// Alpaca's news feed replaces Finnhub's here. Sources stay deliberately
// diverse: any single wire skews toward its own desk, so Alpaca is blended with
// several public RSS feeds (CNBC, MarketWatch, Seeking Alpha, Investing.com,
// Yahoo Finance, NPR Business) and interleaved round-robin by source so no
// outlet saturates the row. Every source is fetched best-effort — any that
// fails or blocks is skipped.
//
// The cap is generous because the app has somewhere to put the tail: the row
// shows the first handful and "View more" opens the lot with a search box over
// them.

export const revalidate = 900;

const RSS_SOURCES: { name: string; url: string }[] = [
    { name: "CNBC", url: "https://www.cnbc.com/id/100003114/device/rss/rss.html" },
    { name: "MarketWatch", url: "https://feeds.content.dowjones.io/public/rss/mw_topstories" },
    { name: "Seeking Alpha", url: "https://seekingalpha.com/market_currents.xml" },
    { name: "Investing.com", url: "https://www.investing.com/rss/news.rss" },
    { name: "Yahoo Finance", url: "https://finance.yahoo.com/news/rssindex" },
    { name: "NPR Business", url: "https://feeds.npr.org/1006/rss.xml" },
];

async function fetchAlpaca(): Promise<NewsArticle[]> {
    const items = await alpacaNews({ limit: 30 }, revalidate);
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

export async function GET() {
    const [alpaca, ...rss] = await Promise.all([
        fetchAlpaca(),
        ...RSS_SOURCES.map((s) => fetchRssFeed(s.name, s.url, revalidate)),
    ]);

    const articles = interleaveBySource([...rss, alpaca], 90);
    return NextResponse.json({ articles });
}
