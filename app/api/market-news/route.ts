import { NextResponse } from "next/server";

// General market news for the discover landing's News row. Finnhub /news is
// free-tier. Same article shape as /api/news (minus the symbol).

export const revalidate = 900;

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
const BASE_URL = "https://finnhub.io/api/v1";

export async function GET() {
    if (!FINNHUB_API_KEY) {
        return NextResponse.json({ error: "Finnhub API key not configured." }, { status: 500 });
    }

    try {
        const res = await fetch(
            `${BASE_URL}/news?category=general&token=${FINNHUB_API_KEY}`,
            { next: { revalidate } },
        );
        if (!res.ok) {
            return NextResponse.json({ articles: [] });
        }
        const raw = (await res.json()) as any[];

        const articles = (Array.isArray(raw) ? raw : [])
            .filter((a) => a && a.headline && a.url)
            .slice(0, 15)
            .map((a) => ({
                id: String(a.id ?? a.url),
                headline: a.headline,
                source: a.source ?? "",
                url: a.url,
                image: a.image ?? "",
                datetime: typeof a.datetime === "number" ? a.datetime : null,
                summary: a.summary ?? "",
            }));

        return NextResponse.json({ articles });
    } catch {
        return NextResponse.json({ articles: [] });
    }
}
