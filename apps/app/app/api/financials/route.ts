import { NextRequest, NextResponse } from "next/server";

// Revenue + net-profit series (the "Financials" bars), annual and quarterly,
// read from the SEC's free XBRL company-facts data — the same source
// /api/statements uses. No vendor key, and the filings themselves rather than a
// vendor's reading of them.
//
// GET /api/financials?symbol=AAPL
//   → { symbol, annual: [{ year, revenue, netProfit }], quarterly: [{ year, quarter, … }] }
//
// Not every symbol files with the SEC (foreign listings, most ETFs) and not
// every filer tags every line. Empty arrays are the honest answer, and the iOS
// section hides itself on empty.

export const revalidate = 86400;

const SEC_HEADERS = {
    // The SEC blocks callers who don't identify themselves with a reachable
    // contact. Override with SEC_CONTACT, e.g. "FinnaCalc you@finnacalc.com".
    "User-Agent": process.env.SEC_CONTACT ?? "FinnaCalc helpfinnacalc@gmail.com",
    Accept: "application/json",
};

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

async function cikFor(symbol: string): Promise<string | null> {
    const res = await fetch("https://www.sec.gov/files/company_tickers.json", {
        headers: SEC_HEADERS,
        next: { revalidate: 604800 }, // the ticker map moves slowly
    });
    if (!res.ok) return null;
    const all = (await res.json()) as Record<string, { cik_str: number; ticker: string }>;
    // Class shares are written BRK.B by people and by quote feeds, but the SEC
    // writes them BRK-B.
    const candidates = [symbol, symbol.replace(/\./g, "-")];
    const hit = Object.values(all).find((company) => candidates.includes(company.ticker));
    return hit ? String(hit.cik_str).padStart(10, "0") : null;
}

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

const EMPTY = (symbol: string) => NextResponse.json({ symbol, annual: [], quarterly: [] });

export async function GET(request: NextRequest) {
    const symbol = request.nextUrl.searchParams.get("symbol")?.toUpperCase().trim();
    if (!symbol) {
        return NextResponse.json({ error: "symbol is required" }, { status: 400 });
    }

    try {
        const cik = await cikFor(symbol);
        if (!cik) return EMPTY(symbol);

        const res = await fetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`, {
            headers: SEC_HEADERS,
            next: { revalidate },
        });
        if (!res.ok) return EMPTY(symbol);

        const doc = (await res.json()) as any;
        const facts = doc?.facts?.["us-gaap"];
        if (!facts) return EMPTY(symbol);

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

        return NextResponse.json({
            symbol,
            annual: build("annual"),
            quarterly: build("quarterly"),
        });
    } catch {
        return EMPTY(symbol);
    }
}
