import { NextRequest, NextResponse } from "next/server";

// Ten years of income statement, balance sheet and cash flow, from the SEC's
// free XBRL company-facts data. No API key and no database: one SEC call per
// company per day, cached at the edge, so traffic never reaches their servers.
//
// GET /api/statements?symbol=AAPL
//
// The SEC asks two things of automated callers: stay under 10 requests per
// second, and identify yourself in the User-Agent with a working contact.
// Set SEC_CONTACT, e.g. "FinnaCalc you@finnacalc.com".
//
// Supersedes /api/financials for the annual view: that route reads Finnhub's
// financials-reported, which is free-tier but caps out at four periods and
// varies by filer. This reads the filings themselves.

export const revalidate = 86400;

const SEC_HEADERS = {
    // The SEC blocks callers who don't identify themselves with a REACHABLE
    // contact, so the fallback has to be an address that actually receives
    // mail. Override it with SEC_CONTACT in the environment.
    "User-Agent": process.env.SEC_CONTACT ?? "FinnaCalc helpfinnacalc@gmail.com",
    Accept: "application/json",
};

// Each row lists the us-gaap tags companies actually use, best first. Tags are
// MERGED across the list rather than first-wins: filers change tags mid-history
// (Apple moved off SalesRevenueNet when ASC 606 landed in 2019), so first-wins
// silently drops every year before the switch.
type Row = [label: string, tags: string[]];

const INCOME: Row[] = [
    ["Revenue", [
        "RevenueFromContractWithCustomerExcludingAssessedTax",
        "RevenueFromContractWithCustomerIncludingAssessedTax",
        "Revenues",
        "SalesRevenueNet",
        "SalesRevenueGoodsNet",
    ]],
    ["Cost of revenue", [
        "CostOfRevenue",
        "CostOfGoodsAndServicesSold",
        "CostOfGoodsSold",
    ]],
    ["Gross profit", ["GrossProfit"]],
    ["Research & development", ["ResearchAndDevelopmentExpense"]],
    ["Selling, general & admin", [
        "SellingGeneralAndAdministrativeExpense",
        "GeneralAndAdministrativeExpense",
    ]],
    ["Operating income", ["OperatingIncomeLoss"]],
    ["Pretax income", [
        "IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest",
        "IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments",
    ]],
    ["Income tax", ["IncomeTaxExpenseBenefit"]],
    ["Net income", ["NetIncomeLoss", "ProfitLoss"]],
    ["Earnings per share (diluted)", ["EarningsPerShareDiluted"]],
];

const BALANCE: Row[] = [
    ["Cash & equivalents", ["CashAndCashEquivalentsAtCarryingValue"]],
    ["Total current assets", ["AssetsCurrent"]],
    ["Total assets", ["Assets"]],
    ["Total current liabilities", ["LiabilitiesCurrent"]],
    ["Long-term debt", ["LongTermDebtNoncurrent", "LongTermDebt"]],
    ["Total liabilities", ["Liabilities"]],
    ["Shareholders equity", [
        "StockholdersEquity",
        "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest",
    ]],
];

const CASHFLOW: Row[] = [
    ["Operating cash flow", [
        "NetCashProvidedByUsedInOperatingActivities",
        "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations",
    ]],
    ["Capital expenditure", ["PaymentsToAcquirePropertyPlantAndEquipment"]],
    ["Investing cash flow", ["NetCashProvidedByUsedInInvestingActivities"]],
    ["Financing cash flow", ["NetCashProvidedByUsedInFinancingActivities"]],
    ["Dividends paid", ["PaymentsOfDividendsCommonStock", "PaymentsOfDividends"]],
    ["Share buybacks", ["PaymentsForRepurchaseOfCommonStock"]],
];

type Fact = {
    start?: string;
    end: string;
    val: number;
    form?: string;
    fp?: string;
    filed?: string;
};

function unitsOf(node: any): Fact[] {
    return (node?.units?.USD ?? Object.values(node?.units ?? {})[0] ?? []) as Fact[];
}

function isAnnualForm(u: Fact): boolean {
    return u.form === "10-K" || u.form === "20-F";
}

/** The month a company closes its books, read off its own annual balances. */
function fiscalYearEndMonth(facts: Record<string, any>): number {
    for (const tag of ["Assets", "StockholdersEquity", "Liabilities"]) {
        const months = unitsOf(facts[tag])
            .filter((u) => isAnnualForm(u) && u.fp === "FY")
            .map((u) => Number(u.end.slice(5, 7)));
        if (months.length) {
            const tally = new Map<number, number>();
            for (const m of months) tally.set(m, (tally.get(m) ?? 0) + 1);
            return [...tally.entries()].sort((a, b) => b[1] - a[1])[0][0];
        }
    }
    return 12;
}

/**
 * Which fiscal year a period belongs to, taken from its END date.
 *
 * Deliberately NOT the `fy` field. In company facts, `fy` and `fp` describe the
 * REPORT a number appeared in, so all three comparative years inside one 10-K
 * carry that 10-K's fy. Keying on it shifts the whole table by a year or more,
 * which is how a chart ends up labelling FY2023 revenue as 2025.
 *
 * A period belongs to the year it ends in, unless the books close early in the
 * calendar year (January to May, common in retail), where it covers mostly the
 * prior year and is labelled that way so companies stay comparable.
 */
function fiscalYear(end: string, fyeMonth: number): number {
    const year = Number(end.slice(0, 4));
    return fyeMonth <= 5 ? year - 1 : year;
}

/** Annual values by fiscal year, merged across tags; newest filing wins. */
function series(facts: Record<string, any>, tags: string[], fyeMonth: number) {
    const merged = new Map<number, number>();
    for (const tag of tags) {
        if (!facts[tag]) continue;
        const best = new Map<number, Fact>();
        for (const u of unitsOf(facts[tag])) {
            if (!isAnnualForm(u)) continue;
            if (u.start) {
                // A duration fact must cover the year, not a quarter inside it.
                const months =
                    (Number(u.end.slice(0, 4)) - Number(u.start.slice(0, 4))) * 12 +
                    (Number(u.end.slice(5, 7)) - Number(u.start.slice(5, 7)));
                if (months < 11) continue;
            }
            const fy = fiscalYear(u.end, fyeMonth);
            const prev = best.get(fy);
            // Restatements: the most recently filed version of a period wins.
            if (!prev || (u.filed ?? "") > (prev.filed ?? "")) best.set(fy, u);
        }
        // Earlier tags in the list are more authoritative, so never overwrite.
        for (const [fy, fact] of best) if (!merged.has(fy)) merged.set(fy, fact.val);
    }
    return merged;
}

async function cikFor(symbol: string): Promise<string | null> {
    const res = await fetch("https://www.sec.gov/files/company_tickers.json", {
        headers: SEC_HEADERS,
        next: { revalidate: 604800 }, // the ticker map moves slowly
    });
    if (!res.ok) return null;
    const all = (await res.json()) as Record<string, { cik_str: number; ticker: string }>;
    const hit = Object.values(all).find((c) => c.ticker === symbol);
    return hit ? String(hit.cik_str).padStart(10, "0") : null;
}

// Not every symbol files with the SEC (foreign listings, most ETFs), and not
// every filer tags every line. Empty is the honest answer and the iOS section
// hides itself on empty, exactly like /api/financials does.
const EMPTY = (symbol: string) => NextResponse.json({ symbol, years: [], statements: [] });

export async function GET(req: NextRequest) {
    const symbol = (req.nextUrl.searchParams.get("symbol") ?? "").toUpperCase().trim();
    if (!symbol) {
        return NextResponse.json({ error: "symbol is required" }, { status: 400 });
    }

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

    const fyeMonth = fiscalYearEndMonth(facts);
    const built = [
        { name: "Income statement", rows: INCOME },
        { name: "Balance sheet", rows: BALANCE },
        { name: "Cash flow", rows: CASHFLOW },
    ].map((statement) => ({
        name: statement.name,
        rows: statement.rows.map(([label, tags]) => ({
            label,
            data: series(facts, tags, fyeMonth),
        })),
    }));

    const everyYear = new Set<number>();
    for (const s of built) for (const r of s.rows) for (const y of r.data.keys()) everyYear.add(y);
    const years = [...everyYear].sort((a, b) => a - b).slice(-10);

    return NextResponse.json({
        symbol,
        companyName: doc.entityName ?? symbol,
        cik,
        fiscalYearEndMonth: fyeMonth,
        years,
        statements: built
            .map((statement) => ({
                name: statement.name,
                rows: statement.rows
                    // null, never 0, for a year a company did not report a line:
                    // the app has to tell "nothing here" from "they reported zero".
                    .map((r) => ({ label: r.label, values: years.map((y) => r.data.get(y) ?? null) }))
                    .filter((r) => r.values.some((v) => v !== null)),
            }))
            // Banks and insurers legitimately have no gross profit or R&D, so a
            // statement with nothing in it is dropped rather than shown empty.
            .filter((statement) => statement.rows.length > 0),
        source: "SEC EDGAR XBRL company facts",
    });
}
