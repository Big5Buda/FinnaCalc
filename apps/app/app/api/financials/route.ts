import { NextRequest, NextResponse } from "next/server";
import { cikFor, OK, reportOf, secJson, type SourceReport } from "@/lib/sec";

// Revenue + net-profit series (the "Financials" bars), annual and quarterly,
// read from the SEC's free XBRL company-facts data — the same source
// /api/statements uses. No vendor key, and the filings themselves rather than a
// vendor's reading of them.
//
// GET /api/financials?symbol=AAPL
//   → { symbol, annual: [{ year, revenue, netProfit }], quarterly: [{ … }],
//       status, reason }
//
// Not every symbol files with the SEC (foreign listings, most ETFs) and not
// every filer tags every line. That is `status: "no-data"`, and an empty
// section is the honest rendering of it. `status: "unavailable"` is a different
// answer — the SEC refused us, and we know nothing about this company — so the
// caller must say so rather than hide. See lib/sec.ts.

export const revalidate = 86400;

const REVENUE_TAGS = [
    "RevenueFromContractWithCustomerExcludingAssessedTax",
    "RevenueFromContractWithCustomerIncludingAssessedTax",
    "Revenues",
    "SalesRevenueNet",
    "SalesRevenueGoodsNet",
];

const NET_INCOME_TAGS = ["NetIncomeLoss", "ProfitLoss"];

type Fact = {
    start?: string;
    end: string;
    val: number;
    form: string;
    fp?: string;
    fy?: number;
    frame?: string;
};

/** USD facts for the first tag a filer actually uses, merged across tags. */
function factsFor(facts: Record<string, any>, tags: string[]): Fact[] {
    const out: Fact[] = [];
    for (const tag of tags) {
        const units = facts?.[tag]?.units?.USD;
        if (Array.isArray(units)) out.push(...(units as Fact[]));
    }
    return out;
}

/** A period's length in days — how annual and quarterly filings are told apart. */
function spanDays(fact: Fact): number | null {
    if (!fact.start || !fact.end) return null;
    const days = (Date.parse(fact.end) - Date.parse(fact.start)) / 86_400_000;
    return Number.isFinite(days) ? days : null;
}

/**
 * One value per period, keyed by its end date. Later filings restate earlier
 * ones, so the last value written for a period wins.
 */
function byPeriod(facts: Fact[], kind: "annual" | "quarterly"): Map<string, Fact> {
    const out = new Map<string, Fact>();
    for (const fact of facts) {
        const span = spanDays(fact);
        if (span === null) continue;
        const isAnnual = span > 300 && span < 400;
        const isQuarter = span > 60 && span < 120;
        if (kind === "annual" ? !isAnnual : !isQuarter) continue;
        if (kind === "annual" && !/^10-K/.test(fact.form)) continue;
        if (kind === "quarterly" && !/^10-[QK]/.test(fact.form)) continue;
        out.set(fact.end, fact);
    }
    return out;
}

/**
 * The shape stays the same whatever happened, so every caller — including iOS
 * builds already in the wild, which read only `annual` and `quarterly` — keeps
 * parsing it. What's new is the report saying whether empty means "nothing to
 * report" or "we couldn't find out".
 */
const empty = (symbol: string, report: SourceReport) =>
    NextResponse.json({ symbol, annual: [], quarterly: [], ...report });

export async function GET(request: NextRequest) {
    const symbol = request.nextUrl.searchParams.get("symbol")?.toUpperCase().trim();
    if (!symbol) {
        return NextResponse.json({ error: "symbol is required" }, { status: 400 });
    }

    try {
        const cik = await cikFor(symbol);
        if (cik.status !== "ok") return empty(symbol, reportOf(cik));

        const facts_ = await secJson<any>(
            `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik.data}.json`,
            revalidate
        );
        if (facts_.status !== "ok") return empty(symbol, reportOf(facts_));

        const facts = facts_.data?.facts?.["us-gaap"];
        if (!facts) {
            return empty(symbol, {
                status: "no-data",
                reason: `${symbol} files with the SEC but doesn't tag its statements in US GAAP.`,
            });
        }

        const revenue = factsFor(facts, REVENUE_TAGS);
        const netIncome = factsFor(facts, NET_INCOME_TAGS);

        const build = (kind: "annual" | "quarterly") => {
            const revenueByPeriod = byPeriod(revenue, kind);
            const incomeByPeriod = byPeriod(netIncome, kind);
            const periods = [...revenueByPeriod.keys()]
                .filter((end) => incomeByPeriod.has(end))
                .sort()
                .slice(-(kind === "annual" ? 10 : 12));

            return periods.map((end) => {
                const date = new Date(end);
                const revenueFact = revenueByPeriod.get(end) as Fact;
                const incomeFact = incomeByPeriod.get(end) as Fact;
                return {
                    year: date.getUTCFullYear(),
                    // The SEC dates a period by its end, so the quarter is the
                    // calendar quarter that date falls in — which is what the
                    // app labels ("Q1 '24").
                    quarter: kind === "quarterly" ? Math.floor(date.getUTCMonth() / 3) + 1 : null,
                    revenue: revenueFact.val,
                    netProfit: incomeFact.val,
                };
            });
        };

        const annual = build("annual");
        const quarterly = build("quarterly");

        return NextResponse.json({
            symbol,
            annual,
            quarterly,
            // A filer whose tags we simply couldn't match is "no-data", not a
            // silent success: the section is empty either way, but only one of
            // those is something the reader should be told.
            ...(annual.length || quarterly.length
                ? OK
                : {
                      status: "no-data" as const,
                      reason: `The SEC has no revenue and net income tagged for ${symbol}.`,
                  }),
        });
    } catch {
        // A bug in our own parsing, not the SEC's answer. Say we don't know.
        return empty(symbol, {
            status: "unavailable",
            reason: "The filings couldn't be read.",
        });
    }
}
