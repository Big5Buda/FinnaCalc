import { NextRequest, NextResponse } from "next/server";
import { isAlpacaConfigured, multiBars } from "@/lib/alpaca";

// Batched sparkline closes for the watchlist and the market overview: one
// Alpaca request for the whole list, cached 15 minutes.
//
// Response: { sparklines: { "AAPL": [c, c, ...], "MSFT": [ ... ] } } oldest to newest
//
// THE LIMIT IS PER REQUEST, NOT PER SYMBOL.
// ----------------------------------------
// Alpaca's multi-symbol bars endpoint applies `limit` to the WHOLE response and
// pages the rest behind a token. Passing a flat 40 therefore bought forty bars
// for the entire call, handed out symbol by symbol in alphabetical order until
// they ran out. One symbol looked perfect. Two split them 28 and 12. Four left
// the last two with no line at all, which the client drew as "this symbol has
// no history" when the truth was that we asked for a budget of forty and spent
// it before we reached them.
//
// So the limit is scaled by the number of symbols asked for. That keeps it a
// single request, and 25 symbols at 40 bars each is 1,000, far inside Alpaca's
// per-request ceiling, so nothing here needs to follow the page token.

export const revalidate = 900;

const MAX_SYMBOLS = 25;

/** Bars per symbol. 40 calendar days is about 28 trading days of line. */
const BARS_PER_SYMBOL = 40;

export async function GET(request: NextRequest) {
    const raw = request.nextUrl.searchParams.get("symbols") || "";
    const symbols = Array.from(
        new Set(
            raw
                .split(",")
                .map((s) => s.trim().toUpperCase())
                .filter(Boolean)
        )
    ).slice(0, MAX_SYMBOLS);

    if (symbols.length === 0) {
        return NextResponse.json({ sparklines: {} });
    }
    if (!isAlpacaConfigured) {
        return NextResponse.json({ error: "Market data is not configured." }, { status: 503 });
    }

    try {
        const start = new Date(Date.now() - BARS_PER_SYMBOL * 24 * 60 * 60 * 1000);
        // Scaled by the symbol count: see the note at the top of this file.
        const series = await multiBars(
            symbols,
            "1Day",
            start,
            BARS_PER_SYMBOL * symbols.length,
            revalidate
        );

        const sparklines: Record<string, number[]> = {};
        for (const symbol of symbols) {
            const closes = (series[symbol] ?? []).map((bar) => bar.c).filter(Number.isFinite);
            // Symbols Alpaca has nothing for are simply absent, so the client
            // renders no line rather than a flat invented one.
            if (closes.length > 1) sparklines[symbol] = closes;
        }

        return NextResponse.json({ sparklines });
    } catch (err: any) {
        return NextResponse.json({ error: err.message || "Failed to fetch sparklines." }, { status: 500 });
    }
}
