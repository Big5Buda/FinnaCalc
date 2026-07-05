import { NextRequest, NextResponse } from "next/server";

// Batched sparkline closes for the watchlist. Twelve Data accepts a
// comma-separated symbol list and returns a per-symbol keyed object, so the
// whole watchlist is one HTTP request (and cached 15 min) — avoiding the free
// tier's 8-req/min limit that per-symbol candle calls would hit.
//
// Response: { sparklines: { "AAPL": [c, c, …], "MSFT": [ … ] } }  (oldest→newest)

export const revalidate = 900;

const TD_KEY = process.env.TWELVE_DATA_API_KEY;
const TD_BASE = "https://api.twelvedata.com/time_series";
const MAX_SYMBOLS = 25;

function closesFrom(node: any): number[] {
    const values = Array.isArray(node?.values) ? node.values : [];
    // order=ASC is requested, so values are already oldest→newest.
    return values
        .map((v: any) => Number(v?.close))
        .filter((n: number) => Number.isFinite(n));
}

export async function GET(request: NextRequest) {
    const raw = new URL(request.url).searchParams.get("symbols") || "";
    const symbols = Array.from(
        new Set(
            raw
                .split(",")
                .map((s) => s.trim().toUpperCase())
                .filter(Boolean),
        ),
    ).slice(0, MAX_SYMBOLS);

    if (symbols.length === 0) {
        return NextResponse.json({ sparklines: {} });
    }
    if (!TD_KEY) {
        return NextResponse.json({ error: "Chart data key not configured." }, { status: 500 });
    }

    try {
        const url =
            `${TD_BASE}?symbol=${encodeURIComponent(symbols.join(","))}` +
            `&interval=1day&outputsize=30&order=ASC&apikey=${TD_KEY}`;
        const res = await fetch(url, { next: { revalidate } });
        if (!res.ok) {
            return NextResponse.json({ sparklines: {} });
        }

        const json = (await res.json()) as any;
        const sparklines: Record<string, number[]> = {};

        if (symbols.length === 1) {
            // Single-symbol requests return the node directly (no symbol key).
            sparklines[symbols[0]] = closesFrom(json);
        } else {
            for (const sym of symbols) {
                sparklines[sym] = closesFrom(json?.[sym]);
            }
        }

        return NextResponse.json({ sparklines });
    } catch {
        return NextResponse.json({ sparklines: {} });
    }
}
