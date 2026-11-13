import { NextRequest, NextResponse } from "next/server";
import { cashDividends, isAlpacaConfigured } from "@/lib/alpaca";

/**
 * Dividends actually paid, and dividends already declared, for a set of
 * holdings.
 *
 * WHY THIS ROUTE EXISTS AT ALL
 * ----------------------------
 * The Dividends card in Portfolio Analysis has never had data. Its only input
 * was a yield percentage that /api/stock hardcodes to null, so the card told
 * an investor holding SCHD, KO and JEPI that none of their holdings pays a
 * dividend, and its "upcoming" list was one row per paying holding with the
 * literal words "About every 3 months" and an annual figure divided by four.
 * There were no dates anywhere in the product.
 *
 * WHY ALPACA AND NOT THE SEC
 * --------------------------
 * The SEC's XBRL data does carry dividend amounts, and plenty of them: KO has
 * 94 quarters of CommonStockDividendsPerShareDeclared. But every point is
 * stamped with a FISCAL PERIOD, not a payment date. It can tell you a company
 * paid $0.39 during the quarter ending 2018-09-28; it cannot tell you the day
 * it went ex, or the day the cash arrived. A calendar needs dates, so SEC data
 * can total a year and cannot place a single dot.
 *
 * Alpaca's corporate actions carry ex_date, record_date and payable_date
 * alongside the rate, and a window whose end is in the future returns
 * dividends that have been declared but not yet paid. That is both halves the
 * card wants, from credentials this backend already holds.
 *
 * WHAT IT STILL CANNOT DO, so the app does not pretend otherwise:
 *  • Nothing is forecast. A dividend appears here only once the company has
 *    declared it. "Four more like the last one" is a guess about a decision a
 *    board has not made, and it is not made here.
 *  • The amount is per share as of the ex date. Multiplying by today's share
 *    count is the app's business, and it is only right for shares held on that
 *    date, which is why the client labels a past payment as an estimate unless
 *    the holding predates it.
 *  • Coverage is whatever Alpaca knows. A symbol with no rows is absent, and
 *    absent means unknown, never "pays nothing".
 */

export const revalidate = 21600;
export const maxDuration = 30;

/** Far more than a real portfolio, and an abuse ceiling rather than a limit. */
const MAX_SYMBOLS = 60;

/** How far back the paid history reaches. */
const LOOKBACK_DAYS = 400;

/**
 * How far forward to ask for declared dividends. A quarter plus a margin: a
 * board typically declares four to eight weeks before the ex date, so a wider
 * window returns nothing extra and a narrower one clips the next payment.
 */
const LOOKAHEAD_DAYS = 120;

export async function GET(request: NextRequest) {
    if (!isAlpacaConfigured) {
        return NextResponse.json({ error: "Market data is not configured." }, { status: 503 });
    }

    const asked = (request.nextUrl.searchParams.get("symbols") ?? "")
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);

    const unique = [...new Set(asked)];
    const symbols = unique.slice(0, MAX_SYMBOLS);
    const truncated = unique.slice(MAX_SYMBOLS);

    if (symbols.length === 0) {
        return NextResponse.json({ error: "symbols is required." }, { status: 400 });
    }

    const now = Date.now();
    const start = new Date(now - LOOKBACK_DAYS * 86400_000);
    const end = new Date(now + LOOKAHEAD_DAYS * 86400_000);

    try {
        const rows = await cashDividends(symbols, start, end, revalidate);

        const today = new Date().toISOString().slice(0, 10);
        const payments = rows
            .map((row) => {
                // Ex date is the one a dividend is really keyed on, and the one
                // Alpaca always sends. Payable is what a user cares about and
                // is occasionally absent, so it stays nullable rather than
                // being backfilled with the ex date, which would be a date we
                // invented.
                const exDate = row.ex_date ?? null;
                const payDate = row.payable_date ?? null;
                const anchor = payDate ?? exDate;
                if (!anchor || !Number.isFinite(row.rate)) return null;
                return {
                    symbol: row.symbol?.toUpperCase() ?? "",
                    /** Per share, in the listing currency. */
                    rate: row.rate,
                    exDate,
                    payDate,
                    recordDate: row.record_date ?? null,
                    /** Whether the cash has already been paid out. */
                    paid: anchor <= today,
                    special: row.special === true,
                };
            })
            .filter((row): row is NonNullable<typeof row> => row !== null && row.symbol !== "")
            .sort((a, b) => (a.payDate ?? a.exDate ?? "").localeCompare(b.payDate ?? b.exDate ?? ""));

        // Symbols that returned nothing are named, because "Alpaca has no
        // dividend record for this" and "this pays no dividend" are different
        // facts and the card must not print the second one.
        const covered = new Set(payments.map((p) => p.symbol));
        const noRecord = symbols.filter((s) => !covered.has(s));

        return NextResponse.json({
            payments,
            noRecord,
            windowStart: start.toISOString().slice(0, 10),
            windowEnd: end.toISOString().slice(0, 10),
            source: "Alpaca corporate actions",
            ...(truncated.length ? { truncated } : {}),
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message || "Failed to fetch dividends." }, { status: 500 });
    }
}
