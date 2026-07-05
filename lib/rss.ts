// Shared RSS helpers for the news routes (market-news, news).
//
// Finnhub's feeds skew heavily Reuters, so the news routes blend in public
// RSS feeds from other outlets. This module holds the tolerant <item>
// extractor and the round-robin interleaver that keeps any one source from
// saturating a news row.

export type NewsArticle = {
    id: string;
    headline: string;
    source: string;
    url: string;
    image: string;
    datetime: number | null;
    summary: string;
};

export const BROWSER_UA =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

// Extract one tag's text from an <item> blob (CDATA-safe, entity-decoded).
function pickTag(item: string, tag: string): string {
    const m = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
    if (!m) return "";
    return m[1]
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&#0?39;/g, "'")
        .replace(/&quot;/g, '"')
        .trim();
}

// Minimal, tolerant RSS <item> extractor (title / link / pubDate; CDATA-safe).
export function parseRssItems(xml: string, sourceName: string, cap = 10): NewsArticle[] {
    const items = xml.match(/<item[\s>][\s\S]*?<\/item>/g) ?? [];
    const out: NewsArticle[] = [];
    for (const item of items.slice(0, cap)) {
        const headline = pickTag(item, "title");
        const url = pickTag(item, "link");
        if (!headline || !url) continue;
        const pub = pickTag(item, "pubDate");
        const ts = pub ? Date.parse(pub) : NaN;
        out.push({
            id: url,
            headline,
            source: sourceName,
            url,
            image: "",
            datetime: Number.isFinite(ts) ? Math.round(ts / 1000) : null,
            summary: pickTag(item, "description").replace(/<[^>]+>/g, "").slice(0, 300),
        });
    }
    return out;
}

// Google News RSS items carry the real outlet in a <source> tag and suffix
// the title with " - Outlet"; extract the outlet and strip the suffix so
// cards show "Quiver Quantitative", not "Google News".
export function parseGoogleNewsItems(xml: string, cap = 12): NewsArticle[] {
    const items = xml.match(/<item[\s>][\s\S]*?<\/item>/g) ?? [];
    const out: NewsArticle[] = [];
    for (const item of items) {
        if (out.length >= cap) break;
        const rawTitle = pickTag(item, "title");
        const url = pickTag(item, "link");
        if (!rawTitle || !url) continue;
        const source = pickTag(item, "source") || "Google News";
        const headline = rawTitle.endsWith(` - ${source}`)
            ? rawTitle.slice(0, -(source.length + 3))
            : rawTitle;
        const pub = pickTag(item, "pubDate");
        const ts = pub ? Date.parse(pub) : NaN;
        out.push({
            id: url,
            headline,
            source,
            url,
            image: "",
            datetime: Number.isFinite(ts) ? Math.round(ts / 1000) : null,
            summary: "",
        });
    }
    return out;
}

// Fetch + parse one RSS feed, best-effort (empty list on any failure).
export async function fetchRssFeed(
    name: string,
    url: string,
    revalidateSeconds: number,
): Promise<NewsArticle[]> {
    try {
        const res = await fetch(url, {
            headers: {
                "User-Agent": BROWSER_UA,
                Accept: "application/rss+xml, application/xml, text/xml, */*",
            },
            next: { revalidate: revalidateSeconds },
        });
        if (!res.ok) return [];
        return parseRssItems(await res.text(), name);
    } catch {
        return [];
    }
}

// Interleave per-source lists round-robin so no outlet saturates the row,
// deduping near-identical headlines.
export function interleaveBySource(lists: NewsArticle[][], cap: number): NewsArticle[] {
    const queues = lists.filter((l) => l.length > 0).map((l) => [...l]);
    const out: NewsArticle[] = [];
    const seen = new Set<string>();
    while (out.length < cap && queues.some((q) => q.length > 0)) {
        for (const q of queues) {
            const next = q.shift();
            if (!next) continue;
            const key = next.headline.toLowerCase().slice(0, 80);
            if (seen.has(key)) continue;
            seen.add(key);
            out.push(next);
            if (out.length >= cap) break;
        }
    }
    return out;
}
