import { NextRequest, NextResponse } from "next/server";
import { resolveRetiredSymbol } from "@/lib/symbol-resolver";

// Price-history (candles) for the native stock chart.
//
// Finnhub's /stock/candle is premium-gated, and Yahoo's public chart API now
// hard-throttles server requests (HTTP 429), so candles come from Twelve Data
// (free tier: 800 req/day, intraday + daily). Set TWELVE_DATA_API_KEY.
//
// Response shape (consumed by iOS MarketService.candles):
//   { symbol, range, previousClose, points: [{ t: epochSeconds, c: close }] }
// `symbol` echoes the symbol actually charted, which differs from the request
// when a retired ticker was resolved to its successor (see lib/symbol-resolver).

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
const CANDLE_INTERVALS = new Set(["1min", "5min", "15min", "30min", "45min", "1h", "1day", "1week"]);

// Twelve Data quotes crypto as a pair ("BTC/USD"); the rest of the app uses the
// provider-neutral "BTCUSD" that Finnhub/FMP expect, which TD returns nothing
// for. Translate on the way out so the Home row's Bitcoin card charts.
// (TD's free tier has no index data at all, so ^GSPC/^IXIC can't be mapped to
// anything here — they legitimately have no chart.)
const TD_SYMBOL_OVERRIDES: Record<string, string> = {
    BTCUSD: "BTC/USD",
    ETHUSD: "ETH/USD",
};

type Point = { t: number; c: number; o?: number; h?: number; l?: number };

/// Twelve Data time-series for one symbol. Returns [] on any miss (unknown
/// symbol, rate limit, network) — the caller can't distinguish, which is why
/// an empty result only *attempts* alias resolution rather than assuming the
/// symbol is retired.
async function fetchPoints(symbol: string, interval: string, outputsize: number): Promise<Point[]> {
    try {
        const tdSymbol = TD_SYMBOL_OVERRIDES[symbol] ?? symbol;
        const url =
            `${TD_BASE}?symbol=${encodeURIComponent(tdSymbol)}` +
            `&interval=${interval}&outputsize=${outputsize}&order=ASC&apikey=${TD_KEY}`;
        const res = await fetch(url, { next: { revalidate } });
        if (!res.ok) return [];

        const json = (await res.json()) as any;
        // Twelve Data signals errors/rate-limits with { status: "error", ... }.
        const values: any[] = json?.status === "error" || !Array.isArray(json?.values)
            ? []
            : json.values;

        // order=ASC gives oldest-first already; map + drop bad closes.
        // Full OHLC rides along for the candlestick view (o/h/l optional
        // client-side, so older app builds keep working).
        const points: Point[] = [];
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
        return points;
    } catch {
        return [];
    }
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const requested = searchParams.get("symbol")?.toUpperCase();
    const rangeKey = (searchParams.get("range") || "1D").toUpperCase();
    const intervalOverride = searchParams.get("interval");

    if (!requested) {
        return NextResponse.json({ error: "Symbol is required." }, { status: 400 });
    }
    const symbol = requested;
    if (!TD_KEY) {
        return NextResponse.json({ error: "Chart data key not configured." }, { status: 500 });
    }

    // An explicit candle interval composes WITH the range: the range picks the
    // window, the interval picks the bar size (bars ≈ window / bar duration).
    const preset = RANGES[rangeKey] ?? RANGES["1D"];
    let interval = preset.interval;
    let outputsize = preset.outputsize;
    if (intervalOverride && CANDLE_INTERVALS.has(intervalOverride)) {
        interval = intervalOverride;
        const INTERVAL_MINUTES: Record<string, number> = {
            "1min": 1, "5min": 5, "15min": 15, "30min": 30, "45min": 45,
            "1h": 60, "1day": 390, "1week": 1950,
        };
        // Trading minutes per range (390/day, ~21 trading days/month).
        const RANGE_MINUTES: Record<string, number> = {
            "1D": 390, "1W": 1950, "1M": 8190, "1Y": 98280, "ALL": 1965600,
        };
        const bars = Math.round(
            (RANGE_MINUTES[rangeKey] ?? 390) / (INTERVAL_MINUTES[intervalOverride] ?? 5),
        );
        outputsize = Math.min(Math.max(bars, 10), 500);
    }

    let charted = symbol;
    let points = await fetchPoints(symbol, interval, outputsize);

    // No bars: the symbol may be a retired ticker (PARA → PSKY). Resolving is
    // only attempted after a live fetch came back empty, and the resolver
    // answers null for any symbol that still trades, so a rate-limited real
    // symbol can never be redirected to something else — it just charts empty
    // as before.
    if (points.length === 0) {
        const alias = await resolveRetiredSymbol(symbol);
        if (alias) {
            const successorPoints = await fetchPoints(alias.to, interval, outputsize);
            if (successorPoints.length > 0) {
                charted = alias.to;
                points = successorPoints;
            }
        }
    }

    return NextResponse.json({ symbol: charted, range: rangeKey, previousClose: null, points });
}
