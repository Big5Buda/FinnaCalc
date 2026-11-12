import type { BarTimeframe } from "@/lib/alpaca"
export const RANGES: Record<string, { timeframe: BarTimeframe; days: number }> = {
    "1D": { timeframe: "5Min", days: 4 },
    "1W": { timeframe: "30Min", days: 9 },
    "1M": { timeframe: "1Day", days: 32 },
    "1Y": { timeframe: "1Day", days: 370 },
    // Five years, weekly: the longest window the app offers, and a promise
    // we can keep. The free plan's history runs out around July 2020 for
    // every older listing checked, so a pill reading "all time" would be a
    // lie next to a company that listed in 1980. Five years sits inside that
    // floor with room to spare, and about 260 weekly bars is well under the
    // limit. Whether five years happens to BE a given symbol's whole life is
    // answered per symbol below, since anything that listed recently really
    // is complete.
    "5Y": { timeframe: "1Week", days: 365 * 5 + 7 },
    // Kept so app builds already shipping "ALL" keep working. New callers
    // should ask for 5Y and say five years.
    ALL: { timeframe: "1Week", days: 365 * 20 },
};

// The candlestick view can ask for its own interval.
export const INTERVALS: Record<string, BarTimeframe> = {
    "1min": "1Min",
    "5min": "5Min",
    "15min": "15Min",
    "30min": "30Min",
    "1h": "1Hour",
    "1day": "1Day",
    "1week": "1Week",
};

/**
 * Bars a trading day can hold at each size, counting extended hours.
 *
 * Deliberate over-estimates. Asking for more rows than exist costs nothing;
 * asking for fewer silently truncates, and Alpaca truncates from the START of
 * the window, so the bars lost are the newest ones.
 */
const BARS_PER_DAY: Record<BarTimeframe, number> = {
    "1Min": 960,
    "5Min": 192,
    "15Min": 64,
    "30Min": 32,
    "1Hour": 16,
    "1Day": 1,
    "1Week": 0.25,
};

/** Alpaca's largest page. */
const MAX_ROWS = 10_000;

/**
 * How many rows this window needs at this bar size.
 *
 * The limit used to be a property of the range pill, which was right only
 * while every pill used its own default bar size. The candlestick view asks
 * for its own interval, and a month of 30-minute bars against the 1M preset's
 * 40-row limit returned two and a half days of a month-old window: a chart
 * labelled "1M" that had not reached the last four weeks. A week of
 * 5-minute bars stopped two sessions short, and a day of 1-minute bars came
 * back as the previous session, cut off mid-morning.
 *
 * So the rows follow the bars, not the pill.
 */
export function rowsFor(timeframe: BarTimeframe, days: number): number {
    const needed = Math.ceil(BARS_PER_DAY[timeframe] * days * 1.1);
    return Math.min(MAX_ROWS, Math.max(100, needed));
}

/**
 * Which exchange day a bar belongs to.
 *
 * Bars are stamped in UTC, and the old code took `t.slice(0, 10)`. That agrees
 * with New York from 00:00 to 19:59 ET and then files the 20:00 ET
 * extended-hours bar under tomorrow, so a late print could invent a session
 * containing exactly one bar.
 */
export const exchangeDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
}).format;

/**
 * Below this a session is a scatter of dots, not a chart.
 *
 * It was 2, which is the arithmetic minimum for a line and nowhere near
 * enough to be one. The free plan serves the IEX feed, one venue out of many,
 * so a thin name can print two or three bars in a whole pre-market and a
 * stock page opened before the bell drew exactly those: two dots, no line,
 * under today's date. Twelve bars is an hour of a 5-minute session or twelve
 * minutes of a 1-minute one; under that the previous session is drawn
 * instead, labelled with its own date, which is what the app says it is
 * showing anyway.
 */
const MIN_SESSION_BARS = 12;

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
export function latestDrawableSession(
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

