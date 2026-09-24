import { NextRequest, NextResponse } from "next/server";
import { searchSymbols } from "@/lib/investing/names";
import { activeSymbolSet, fetchQuotes } from "@/lib/quotes";

// Symbol search.
//
// This used to rank Alpaca's active-asset list. That list comes back empty in
// production, so the route answered `[]` for every query, including exact
// tickers, and search was dead everywhere it appears: the Investing tab's box
// and the simulator's symbol picker both. It looked like a route that worked
// and found nothing, rather than a broken one, because an empty array is a
// perfectly valid answer to "no matches".
//
// The SEC ticker file and curated universe supply names, not current listings:
// SEC keeps acquired and delisted issuers in its records. Keep a result only
// when Alpaca has observed a trade within the last seven days. Older history
// remains reachable from an existing holding, but a retired symbol does not
// appear as a currently searchable stock.
//
// No isAlpacaConfigured gate any more: there is nothing here Alpaca serves, so
// refusing the request when its keys are missing would fail for a reason that
// no longer applies.

// Listing status follows live market data, so do not cache this whole response
// for a day. The SEC ticker directory has its own longer cache in names.ts.
export const revalidate = 300;

export async function GET(request: NextRequest) {
    const keywords = request.nextUrl.searchParams.get("keywords")?.trim();
    if (!keywords) {
        return NextResponse.json({ error: "Keywords are required." }, { status: 400 });
    }

    try {
        const matches = await searchSymbols(keywords, 10);
        const [quotes, activeSymbols] = await Promise.all([
            fetchQuotes(matches.map((match) => match.symbol), 60),
            activeSymbolSet(900),
        ]);
        const currentMatches = matches.filter((match) => {
            const quote = quotes[match.symbol]
            return quote?.isStale === false && (!activeSymbols || activeSymbols.has(match.symbol))
        });

        // The response keys are Alpha Vantage's original shape, which the iOS
        // StockSearchResult still decodes.
        return NextResponse.json(
            currentMatches.map((match) => ({
                "1. symbol": match.symbol,
                "2. name": match.name,
                "4. region": "United States",
            }))
        );
    } catch (err: any) {
        return NextResponse.json({ error: err.message || "Search failed." }, { status: 500 });
    }
}
