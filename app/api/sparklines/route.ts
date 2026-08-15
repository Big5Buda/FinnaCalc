import { NextRequest, NextResponse } from "next/server";
import { isAlpacaConfigured, multiBars } from "@/lib/alpaca";

// Batched sparkline closes for the watchlist — one Alpaca request for the whole
// list, cached 15 minutes.
//
// Response: { sparklines: { "AAPL": [c, c, …], "MSFT": [ … ] } }  (oldest→newest)

export const revalidate = 900;

const MAX_SYMBOLS = 25;

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
        const start = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
        const series = await multiBars(symbols, "1Day", start, 40, revalidate);

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
