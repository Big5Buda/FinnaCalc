import { NextRequest, NextResponse } from "next/server";
import { bars, isAlpacaConfigured, type BarTimeframe } from "@/lib/alpaca";

// Price history for the native chart, from Alpaca's bars endpoint.
//
// Response shape (consumed by iOS MarketService.candles):
//   { symbol, range, points: [{ t: epochSeconds, c: close, o, h, l }] }
//
// No previousClose: the app derives the 1D chart's up/down reference from the
// quote it already has (price − change), which costs no request here.

export const revalidate = 60;

// Range pill → (timeframe, how far back, how many bars to ask for).
const RANGES: Record<string, { timeframe: BarTimeframe; days: number; limit: number }> = {
    "1D": { timeframe: "5Min", days: 4, limit: 500 },
    "1W": { timeframe: "30Min", days: 9, limit: 400 },
    "1M": { timeframe: "1Day", days: 32, limit: 40 },
    "1Y": { timeframe: "1Day", days: 370, limit: 400 },
    ALL: { timeframe: "1Week", days: 365 * 20, limit: 1100 },
};

// The candlestick view can ask for its own interval.
const INTERVALS: Record<string, BarTimeframe> = {
    "1min": "1Min",
    "5min": "5Min",
    "15min": "15Min",
    "30min": "30Min",
    "1h": "1Hour",
    "1day": "1Day",
    "1week": "1Week",
};

export async function GET(request: NextRequest) {
    if (!isAlpacaConfigured) {
        return NextResponse.json({ error: "Market data is not configured." }, { status: 503 });
    }

    const params = request.nextUrl.searchParams;
    const symbol = params.get("symbol")?.toUpperCase().trim();
    const range = (params.get("range") ?? "1M").toUpperCase();
    const interval = params.get("interval");

    if (!symbol) {
        return NextResponse.json({ error: "symbol is required" }, { status: 400 });
    }

    const preset = RANGES[range] ?? RANGES["1M"];
    const timeframe = interval && INTERVALS[interval] ? INTERVALS[interval] : preset.timeframe;
    const start = new Date(Date.now() - preset.days * 24 * 60 * 60 * 1000);

    try {
        const series = await bars(symbol, timeframe, start, preset.limit, revalidate);

        // 1D means the latest session, not the last four calendar days: markets
        // close, and a Monday request must not draw Thursday and Friday too.
        // The window above is deliberately wider than a day so a long weekend
        // still returns something; here it's trimmed back to the final session.
        const trimmed =
            range === "1D" && series.length > 0
                ? (() => {
                      const lastDay = series[series.length - 1].t.slice(0, 10);
                      return series.filter((bar) => bar.t.slice(0, 10) === lastDay);
                  })()
                : series;

        const points = trimmed
            .map((bar) => ({
                t: Math.round(Date.parse(bar.t) / 1000),
                c: bar.c,
                o: bar.o,
                h: bar.h,
                l: bar.l,
            }))
            .filter((point) => Number.isFinite(point.t) && Number.isFinite(point.c));

        return NextResponse.json({ symbol, range, points });
    } catch (err: any) {
        return NextResponse.json({ error: err.message || "Failed to fetch candles." }, { status: 500 });
    }
}
