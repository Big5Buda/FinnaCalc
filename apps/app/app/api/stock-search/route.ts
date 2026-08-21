import { NextRequest, NextResponse } from "next/server";
import { searchSymbols } from "@/lib/investing/names";

// Symbol search.
//
// This used to rank Alpaca's active-asset list. That list comes back empty in
// production, so the route answered `[]` for every query, including exact
// tickers, and search was dead everywhere it appears: the Investing tab's box
// and the simulator's symbol picker both. It looked like a route that worked
// and found nothing, rather than a broken one, because an empty array is a
// perfectly valid answer to "no matches".
//
// It now searches the SEC's free ticker file plus the curated universe and the
// hand-kept fund list (see lib/investing/names.ts), none of which depend on
// Alpaca. That is roughly 10,400 US issuers plus the popular ETFs, matched on
// ticker and on company name, fetched once and cached for a day.
//
// No isAlpacaConfigured gate any more: there is nothing here Alpaca serves, so
// refusing the request when its keys are missing would fail for a reason that
// no longer applies.

export const revalidate = 86400;

export async function GET(request: NextRequest) {
    const keywords = request.nextUrl.searchParams.get("keywords")?.trim();
    if (!keywords) {
        return NextResponse.json({ error: "Keywords are required." }, { status: 400 });
    }

    try {
        const matches = await searchSymbols(keywords, 10);

        // The response keys are Alpha Vantage's original shape, which the iOS
        // StockSearchResult still decodes.
        return NextResponse.json(
            matches.map((match) => ({
                "1. symbol": match.symbol,
                "2. name": match.name,
                "4. region": "United States",
            }))
        );
    } catch (err: any) {
        return NextResponse.json({ error: err.message || "Search failed." }, { status: 500 });
    }
}
