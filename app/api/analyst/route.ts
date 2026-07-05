import { NextRequest, NextResponse } from "next/server";

// Analyst consensus (Cash App "Analyst opinions" slider). Finnhub
// /stock/recommendation is free-tier and returns buy/hold/sell counts by month.

export const revalidate = 3600;

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
const BASE_URL = "https://finnhub.io/api/v1";

function consensusLabel(score: number): string {
    if (score >= 4.5) return "Strong Buy";
    if (score >= 3.5) return "Buy";
    if (score >= 2.5) return "Hold";
    if (score >= 1.5) return "Sell";
    return "Strong Sell";
}

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
            `${BASE_URL}/stock/recommendation?symbol=${symbol}&token=${FINNHUB_API_KEY}`,
            { next: { revalidate } },
        );
        if (!res.ok) {
            return NextResponse.json({ symbol, available: false });
        }
        const raw = (await res.json()) as any[];
        const latest = Array.isArray(raw) && raw.length ? raw[0] : null;
        if (!latest) {
            return NextResponse.json({ symbol, available: false });
        }

        const strongBuy = latest.strongBuy ?? 0;
        const buy = latest.buy ?? 0;
        const hold = latest.hold ?? 0;
        const sell = latest.sell ?? 0;
        const strongSell = latest.strongSell ?? 0;
        const total = strongBuy + buy + hold + sell + strongSell;

        if (total === 0) {
            return NextResponse.json({ symbol, available: false });
        }

        // Weighted 1..5 score, then a 0..1 slider position (Sell -> Buy).
        const score =
            (strongBuy * 5 + buy * 4 + hold * 3 + sell * 2 + strongSell * 1) / total;
        const position = (score - 1) / 4;

        return NextResponse.json({
            symbol,
            available: true,
            period: latest.period ?? null,
            total,
            strongBuy,
            buy,
            hold,
            sell,
            strongSell,
            score,
            position,
            consensus: consensusLabel(score),
        });
    } catch (err: any) {
        return NextResponse.json({ symbol, available: false });
    }
}
