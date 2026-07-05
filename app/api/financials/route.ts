import { NextRequest, NextResponse } from "next/server";

// Revenue + net-profit series (Cash App "Financials" bars), annual + quarterly.
// Finnhub /stock/financials-reported is free-tier but its income-statement
// concepts vary by filer, so extraction is heuristic and fails soft: any period
// missing a clean revenue or net-income value is dropped, and the iOS section
// hides itself when the arrays come back empty.

export const revalidate = 86400;

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
const BASE_URL = "https://finnhub.io/api/v1";

function num(v: any): number | null {
    const n = typeof v === "string" ? Number(v) : v;
    return typeof n === "number" && Number.isFinite(n) ? n : null;
}

// Scan an income-statement array for the best revenue line.
function pickRevenue(ic: any[]): number | null {
    if (!Array.isArray(ic)) return null;
    const byConcept = ic.find((i) => {
        const c = String(i?.concept ?? "");
        return (
            c.endsWith("Revenues") ||
            c.includes("RevenueFromContractWithCustomerExcludingAssessedTax") ||
            c.includes("RevenueFromContractWithCustomerIncludingAssessedTax") ||
            c.endsWith("SalesRevenueNet")
        );
    });
    if (byConcept) return num(byConcept.value);
    const byLabel = ic.find((i) => {
        const l = String(i?.label ?? "").toLowerCase();
        return /(total )?(net )?(revenue|sales)/.test(l) && !/cost|expense|per share/.test(l);
    });
    return byLabel ? num(byLabel.value) : null;
}

function pickNetIncome(ic: any[]): number | null {
    if (!Array.isArray(ic)) return null;
    const byConcept = ic.find((i) => String(i?.concept ?? "").endsWith("NetIncomeLoss"));
    if (byConcept) return num(byConcept.value);
    const byLabel = ic.find((i) => /^net income/.test(String(i?.label ?? "").toLowerCase()));
    return byLabel ? num(byLabel.value) : null;
}

async function series(symbol: string, freq: "annual" | "quarterly") {
    const res = await fetch(
        `${BASE_URL}/stock/financials-reported?symbol=${symbol}&freq=${freq}&token=${FINNHUB_API_KEY}`,
        { next: { revalidate } },
    );
    if (!res.ok) return [];
    const json = (await res.json()) as any;
    const data: any[] = Array.isArray(json?.data) ? json.data : [];

    return data
        .slice(0, 4)
        .reverse()
        .map((d) => {
            const ic = d?.report?.ic ?? [];
            const revenue = pickRevenue(ic);
            const netProfit = pickNetIncome(ic);
            return {
                year: d?.year ?? null,
                quarter: d?.quarter ?? null,
                revenue,
                netProfit,
            };
        })
        .filter((p) => p.revenue !== null && p.netProfit !== null);
}

export async function GET(request: NextRequest) {
    if (!FINNHUB_API_KEY) {
        return NextResponse.json({ error: "Finnhub API key not configured." }, { status: 500 });
    }
    const symbol = new URL(request.url).searchParams.get("symbol")?.toUpperCase();
    if (!symbol) {
        return NextResponse.json({ error: "Symbol is required." }, { status: 400 });
    }

    try {
        const [annual, quarterly] = await Promise.all([
            series(symbol, "annual"),
            series(symbol, "quarterly"),
        ]);
        return NextResponse.json({ symbol, annual, quarterly });
    } catch (err: any) {
        return NextResponse.json({ symbol, annual: [], quarterly: [] });
    }
}
