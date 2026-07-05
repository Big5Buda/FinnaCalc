import { NextRequest, NextResponse } from "next/server";

// Quarterly earnings — actual vs estimated EPS (Cash App "Earnings" section).
// Finnhub /stock/earnings is available on the free tier.

export const revalidate = 3600;

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
const BASE_URL = "https://finnhub.io/api/v1";

export async function GET(request: NextRequest) {
    if (!FINNHUB_API_KEY) {
        return NextResponse.json({ error: "Finnhub API key not configured." }, { status: 500 });
    }
    const symbol = new URL(request.url).searchParams.get("symbol")?.toUpperCase();
    if (!symbol) {
        return NextResponse.json({ error: "Symbol is required." }, { status: 400 });
    }

    try {
        const res = await fetch(
            `${BASE_URL}/stock/earnings?symbol=${symbol}&token=${FINNHUB_API_KEY}`,
            { next: { revalidate } },
        );
        if (!res.ok) {
            return NextResponse.json({ symbol, quarters: [] });
        }
        const raw = (await res.json()) as any[];

        // Finnhub returns most-recent first; take 4 and flip to chronological.
        const quarters = (Array.isArray(raw) ? raw : [])
            .slice(0, 4)
            .reverse()
            .map((e) => ({
                quarter: e.quarter ?? null,
                year: e.year ?? null,
                period: e.period ?? null, // report date, YYYY-MM-DD
                actual: typeof e.actual === "number" ? e.actual : null,
                estimate: typeof e.estimate === "number" ? e.estimate : null,
            }))
            .filter((q) => q.actual !== null || q.estimate !== null);

        return NextResponse.json({ symbol, quarters });
    } catch (err: any) {
        return NextResponse.json({ symbol, quarters: [] });
    }
}
