import { NextRequest, NextResponse } from "next/server";

// Price-history (candles) for the native stock chart.
//
// Finnhub's /stock/candle is premium-gated (403 on the free tier), so this
// route sources OHLC line points from Yahoo's public chart API instead
// (query1.finance.yahoo.com/v8/finance/chart). No API key required; a browser
// User-Agent is needed or Yahoo returns 429/403.
//
// Response shape (consumed by iOS MarketService.candles):
//   { symbol, range, previousClose, points: [{ t: epochSeconds, c: close }] }

export const revalidate = 60;

const YF_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";

// Cash App style range pills -> Yahoo (range, interval).
const RANGES: Record<string, { range: string; interval: string }> = {
    "1D": { range: "1d", interval: "5m" },
    "1W": { range: "5d", interval: "15m" },
    "1M": { range: "1mo", interval: "1d" },
    "1Y": { range: "1y", interval: "1d" },
    "ALL": { range: "max", interval: "1wk" },
};

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get("symbol")?.toUpperCase();
    const rangeKey = (searchParams.get("range") || "1D").toUpperCase();

    if (!symbol) {
        return NextResponse.json({ error: "Symbol is required." }, { status: 400 });
    }

    const { range, interval } = RANGES[rangeKey] ?? RANGES["1D"];

    try {
        const url = `${YF_BASE}/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;
        const res = await fetch(url, {
            headers: {
                // Yahoo rejects requests without a browser-like User-Agent.
                "User-Agent":
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
                Accept: "application/json",
            },
            next: { revalidate },
        });

        if (!res.ok) {
            return NextResponse.json(
                { error: `Chart data unavailable for "${symbol}".` },
                { status: 502 },
            );
        }

        const json = await res.json();
        const result = json?.chart?.result?.[0];
        const timestamps: number[] = result?.timestamp ?? [];
        const closes: (number | null)[] = result?.indicators?.quote?.[0]?.close ?? [];
        const meta = result?.meta ?? {};

        // Pair timestamps with closes, dropping gaps (Yahoo returns nulls for
        // missing bars, e.g. pre/post-market or holidays).
        const points: { t: number; c: number }[] = [];
        for (let i = 0; i < timestamps.length; i++) {
            const c = closes[i];
            if (typeof c === "number" && Number.isFinite(c)) {
                points.push({ t: timestamps[i], c });
            }
        }

        const previousClose =
            typeof meta.chartPreviousClose === "number"
                ? meta.chartPreviousClose
                : typeof meta.previousClose === "number"
                  ? meta.previousClose
                  : null;

        return NextResponse.json({ symbol, range: rangeKey, previousClose, points });
    } catch (err: any) {
        return NextResponse.json(
            { error: err?.message || "Failed to fetch chart data." },
            { status: 500 },
        );
    }
}
