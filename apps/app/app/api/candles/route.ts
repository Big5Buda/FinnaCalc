import { NextRequest, NextResponse } from "next/server";
import { bars, isAlpacaConfigured, type BarAdjustment, type BarTimeframe } from "@/lib/alpaca";

// Price history for the native chart, from Alpaca's bars endpoint.
//
// Response shape (consumed by iOS MarketService.candles):
//   { symbol, range, points: [{ t: epochSeconds, c: close, o, h, l }] }
//
// On 1D the response also carries `session`, the exchange date the bars belong
// to, and `previousClose`, the close before that session opened. Both come out
// of the window already fetched, so neither costs a request. The app needs
// them to say which day it is drawing and to measure the day's move from the
// right reference instead of from the session's first bar.

export const revalidate = 60;

// Range pill → (timeframe, how far back, how many bars to ask for).
const RANGES: Record<string, { timeframe: BarTimeframe; days: number; limit: number }> = {
    "1D": { timeframe: "5Min", days: 4, limit: 500 },
    "1W": { timeframe: "30Min", days: 9, limit: 400 },
    "1M": { timeframe: "1Day", days: 32, limit: 40 },
    "1Y": { timeframe: "1Day", days: 370, limit: 400 },
    // Five years, weekly: the longest window the app offers, and a promise
    // we can keep. The free plan's history runs out around July 2020 for
    // every older listing checked, so a pill reading "all time" would be a
    // lie next to a company that listed in 1980. Five years sits inside that
    // floor with room to spare, and about 260 weekly bars is well under the
    // limit. Whether five years happens to BE a given symbol's whole life is
    // answered per symbol below, since anything that listed recently really
    // is complete.
    "5Y": { timeframe: "1Week", days: 365 * 5 + 7, limit: 300 },
    // Kept so app builds already shipping "ALL" keep working. New callers
    // should ask for 5Y and say five years.
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

/**
 * Which exchange day a bar belongs to.
 *
 * Bars are stamped in UTC, and the old code took `t.slice(0, 10)`. That agrees
 * with New York from 00:00 to 19:59 ET and then files the 20:00 ET
 * extended-hours bar under tomorrow, so a late print could invent a session
 * containing exactly one bar.
 */
const exchangeDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
}).format;

/** Below this a session is a dot, not a chart, and the app draws nothing. */
const MIN_SESSION_BARS = 2;

type Bar = { t: string; c: number; o: number; h: number; l: number };

/**
 * The most recent session that can actually be drawn, plus the close before it.
 *
 * The rule used to be "keep every bar sharing the last bar's date", which
 * breaks in the hour before the open. The free plan serves the IEX feed, one
 * venue out of many, so pre-market prints are sparse: measured on a normal
 * morning, AAPL printed two pre-market bars all day and thinner names printed
 * none. The instant one of those lone bars arrived, the old rule threw away
 * the entire previous session and returned a single point, and a single point
 * draws as an empty card. That is what a user opening the app at 08:50 saw.
 *
 * So: walk back from the newest exchange day and take the first one holding
 * enough bars to plot. A real pre-market session with a handful of prints is
 * kept, extended hours included, which is the "show me pre-market if we have
 * it" half. A day holding one stray print falls through to yesterday, which is
 * the "otherwise show me the last session" half.
 *
 * The chosen date is returned so the app can say which day it is drawing
 * rather than labelling a stale session "today".
 */
function latestDrawableSession(
    series: Bar[]
): { date: string; bars: Bar[]; previousClose: number | null } | null {
    if (series.length === 0) return null;

    const byDate = new Map<string, Bar[]>();
    for (const bar of series) {
        const day = exchangeDate(new Date(bar.t));
        const bucket = byDate.get(day);
        if (bucket) bucket.push(bar);
        else byDate.set(day, [bar]);
    }

    const days = [...byDate.keys()].sort();
    let date = days[days.length - 1];
    for (let i = days.length - 1; i >= 0; i--) {
        if ((byDate.get(days[i]) as Bar[]).length >= MIN_SESSION_BARS) {
            date = days[i];
            break;
        }
    }

    // The last close before the chosen session opened, which is the reference
    // a day's move is measured from. It is already inside the window we
    // fetched, so this costs no extra request. Null when the window does not
    // reach back that far, and null means unknown, never zero.
    const earlier = series.filter((bar) => exchangeDate(new Date(bar.t)) < date);
    const previousClose = earlier.length > 0 ? earlier[earlier.length - 1].c : null;

    return { date, bars: byDate.get(date) as Bar[], previousClose };
}

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

    // Echo back the range actually SERVED, not the one asked for. An unknown
    // range quietly fell through to the 1M preset while the response still
    // said "6M", so a caller could draw one month of bars under a six-month
    // label and never know.
    const served = RANGES[range] ? range : "1M";
    const preset = RANGES[served];
    const timeframe = interval && INTERVALS[interval] ? INTERVALS[interval] : preset.timeframe;
    const start = new Date(Date.now() - preset.days * 24 * 60 * 60 * 1000);

    // Total return rather than price return, for callers asking what a
    // holding actually earned. Charts stay on the split-only default.
    const adjustment: BarAdjustment = params.get("adjustment") === "all" ? "all" : "split";

    try {
        const series = await bars(symbol, timeframe, start, preset.limit, revalidate, adjustment);

        // 1D means the latest session, not the last four calendar days: markets
        // close, and a Monday request must not draw Thursday and Friday too.
        // The window above is deliberately wider than a day so a long weekend
        // still returns something; here it's trimmed back to one session.
        const chosen = served === "1D" ? latestDrawableSession(series) : null;
        const trimmed = chosen ? chosen.bars : series;

        const points = trimmed
            .map((bar) => ({
                t: Math.round(Date.parse(bar.t) / 1000),
                c: bar.c,
                o: bar.o,
                h: bar.h,
                l: bar.l,
            }))
            .filter((point) => Number.isFinite(point.t) && Number.isFinite(point.c));

        // On the long window, say whether this is the symbol's whole life or
        // just as far back as the plan reaches.
        //
        // It differs per symbol and the difference is not cosmetic. Every
        // listing older than the free plan's floor comes back starting on the
        // same week (AAPL, KO, GE, XOM and IBM all begin 2020-07-27), so for
        // those "all time" would be a plain lie: Apple listed in 1980.
        // Symbols that listed after the floor really do come back complete,
        // which is why RDDT starts at its 2024 IPO and HOOD at its 2021 one.
        //
        // Decided from the request rather than a hardcoded floor date, so it
        // cannot rot if the plan's horizon moves: a symbol whose first bar
        // sits at the edge of the window we asked for was already trading
        // before it, and one whose first bar is well inside the window began
        // there. The tolerance leans toward reporting "not complete", because
        // over-disclosing costs a sentence and under-disclosing is a false
        // claim about what the user is looking at.
        let coversAllHistory: boolean | undefined;
        let earliest: string | undefined;
        if ((served === "5Y" || served === "ALL") && points.length > 0) {
            const firstBar = points[0].t * 1000;
            const TOLERANCE_MS = 14 * 24 * 60 * 60 * 1000;
            coversAllHistory = firstBar > start.getTime() + TOLERANCE_MS;
            earliest = exchangeDate(new Date(firstBar));
        }

        // `session` and `previousClose` ride along on 1D only. The app needs
        // both to be honest: which day it is actually drawing, and the close
        // the day's move is measured against.
        return NextResponse.json({
            symbol,
            range: served,
            points,
            ...(chosen ? { session: chosen.date, previousClose: chosen.previousClose } : {}),
            ...(coversAllHistory === undefined ? {} : { coversAllHistory, earliest }),
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message || "Failed to fetch candles." }, { status: 500 });
    }
}
