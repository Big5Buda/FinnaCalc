import { NextRequest, NextResponse } from "next/server";

// Price-history (candles) for the native stock chart.
//
// Finnhub's /stock/candle is premium-gated, and Yahoo's public chart API now
// hard-throttles server requests (HTTP 429), so candles come from Twelve Data
// (free tier: 800 req/day, intraday + daily). Set TWELVE_DATA_API_KEY.
//
// Response shape (consumed by iOS MarketService.candles):
//   { symbol, range, previousClose, points: [{ t: epochSeconds, c: close }] }

export const revalidate = 60;

const TD_KEY = process.env.TWELVE_DATA_API_KEY;
const TD_BASE = "https://api.twelvedata.com/time_series";

// Cash App range pills -> Twelve Data (interval, outputsize).
const RANGES: Record<string, { interval: string; outputsize: number }> = {
    "1D": { interval: "5min", outputsize: 78 },
    "1W": { interval: "30min", outputsize: 66 },
    "1M": { interval: "1day", outputsize: 23 },
    "1Y": { interval: "1day", outputsize: 252 },
    "ALL": { interval: "1week", outputsize: 1040 },
};

function epochSeconds(datetime: string, fallbackIndex: number): number {
    // "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DD". Exchange-local, but the tz offset is
    // constant across a range so ordering (all the chart needs) is preserved.
    const ms = Date.parse(datetime.replace(" ", "T") + "Z");
    return Number.isFinite(ms) ? Math.round(ms / 1000) : fallbackIndex * 60;
}

// Intraday interval overrides for the candlestick view.
const CANDLE_INTERVALS = new Set(["1min", "5min", "15min", "30min", "45min", "1h"]);

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get("symbol")?.toUpperCase();
    const rangeKey = (searchParams.get("range") || "1D").toUpperCase();
    const intervalOverride = searchParams.get("interval");

    if (!symbol) {
        return NextResponse.json({ error: "Symbol is required." }, { status: 400 });
    }
    if (!TD_KEY) {
        return NextResponse.json({ error: "Chart data key not configured." }, { status: 500 });
    }

    // An explicit candle interval (1min/5min/…) wins over the range presets.
    const preset = RANGES[rangeKey] ?? RANGES["1D"];
    const interval = intervalOverride && CANDLE_INTERVALS.has(intervalOverride)
        ? intervalOverride
        : preset.interval;
    const outputsize = intervalOverride && CANDLE_INTERVALS.has(intervalOverride)
        ? 90
        : preset.outputsize;

    try {
        const url =
            `${TD_BASE}?symbol=${encodeURIComponent(symbol)}` +
            `&interval=${interval}&outputsize=${outputsize}&order=ASC&apikey=${TD_KEY}`;
        const res = await fetch(url, { next: { revalidate } });

        if (!res.ok) {
            return NextResponse.json({ symbol, range: rangeKey, previousClose: null, points: [] });
        }

        const json = (await res.json()) as any;
        // Twelve Data signals errors/rate-limits with { status: "error", ... }.
        const values: any[] = json?.status === "error" || !Array.isArray(json?.values)
            ? []
            : json.values;

        // order=ASC gives oldest-first already; map + drop bad closes.
        // Full OHLC rides along for the candlestick view (o/h/l optional
        // client-side, so older app builds keep working).
        const points: { t: number; c: number; o?: number; h?: number; l?: number }[] = [];
        values.forEach((v, i) => {
            const c = Number(v?.close);
            if (Number.isFinite(c) && v?.datetime) {
                const o = Number(v?.open);
                const h = Number(v?.high);
                const l = Number(v?.low);
                points.push({
                    t: epochSeconds(String(v.datetime), i),
                    c,
                    ...(Number.isFinite(o) ? { o } : {}),
                    ...(Number.isFinite(h) ? { h } : {}),
                    ...(Number.isFinite(l) ? { l } : {}),
                });
            }
        });

        return NextResponse.json({ symbol, range: rangeKey, previousClose: null, points });
    } catch (err: any) {
        return NextResponse.json({ symbol, range: rangeKey, previousClose: null, points: [] });
    }
}
