import { NextRequest, NextResponse } from "next/server";
import { activeAssets, isAlpacaConfigured } from "@/lib/alpaca";

// Symbol search over Alpaca's asset list.
//
// Alpaca has no query endpoint, so this ranks the full active US-equity list,
// which is fetched once and cached for a day (it barely moves). Ranking is
// exact symbol, then symbol prefix, then name prefix, then name substring, so
// typing "app" puts AAPL above every company with "app" buried in its name.

export const revalidate = 86400;

export async function GET(request: NextRequest) {
    if (!isAlpacaConfigured) {
        return NextResponse.json({ error: "Market data is not configured." }, { status: 503 });
    }

    const keywords = request.nextUrl.searchParams.get("keywords")?.trim();
    if (!keywords) {
        return NextResponse.json({ error: "Keywords are required." }, { status: 400 });
    }

    try {
        const query = keywords.toUpperCase();
        const assets = await activeAssets();

        const scored = assets
            .filter((entry) => entry.tradable && entry.status === "active" && !entry.symbol.includes("."))
            .map((entry) => {
                const symbol = entry.symbol.toUpperCase();
                const name = (entry.name ?? "").toUpperCase();
                let score = 0;
                if (symbol === query) score = 100;
                else if (symbol.startsWith(query)) score = 80 - symbol.length;
                else if (name.startsWith(query)) score = 60;
                else if (name.includes(query)) score = 40;
                else if (symbol.includes(query)) score = 20;
                return { entry, score };
            })
            .filter((row) => row.score > 0)
            .sort((a, b) => b.score - a.score || a.entry.symbol.localeCompare(b.entry.symbol))
            .slice(0, 10);

        // The response keys are Alpha Vantage's original shape, which the iOS
        // StockSearchResult still decodes.
        return NextResponse.json(
            scored.map(({ entry }) => ({
                "1. symbol": entry.symbol,
                "2. name": entry.name,
                "4. region": "United States",
            }))
        );
    } catch (err: any) {
        return NextResponse.json({ error: err.message || "Search failed." }, { status: 500 });
    }
}
