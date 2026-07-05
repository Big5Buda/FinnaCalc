import { NextRequest, NextResponse } from "next/server";

// Stock screener backed by Financial Modeling Prep's /stock-screener, which
// filters the whole US market server-side (Finnhub has no free screener). Set
// FMP_API_KEY. Fails soft to an empty list; surfaces a message when the key is
// missing so the app can prompt for it.
//
// Response: { rows: ScreenerRow[], error?: string }

export const revalidate = 300;

const FMP_KEY = process.env.FMP_API_KEY;
const FMP = "https://financialmodelingprep.com/api/v3/stock-screener";

// Filter params passed straight through to FMP (whitelisted).
const PASSTHROUGH = [
    "marketCapMoreThan",
    "marketCapLowerThan",
    "priceMoreThan",
    "priceLowerThan",
    "betaMoreThan",
    "betaLowerThan",
    "volumeMoreThan",
    "volumeLowerThan",
    "dividendMoreThan",
    "dividendLowerThan",
    "sector",
    "industry",
    "exchange",
    "country",
    "isEtf",
    "isActivelyTrading",
    "limit",
];

export async function GET(request: NextRequest) {
    if (!FMP_KEY) {
        return NextResponse.json({
            rows: [],
            error: "Screener not configured — add FMP_API_KEY.",
        });
    }

    const incoming = new URL(request.url).searchParams;
    const params = new URLSearchParams();
    for (const key of PASSTHROUGH) {
        const v = incoming.get(key);
        if (v != null && v !== "") params.set(key, v);
    }
    if (!params.has("limit")) params.set("limit", "100");
    if (!params.has("isActivelyTrading")) params.set("isActivelyTrading", "true");
    params.set("apikey", FMP_KEY);

    try {
        const res = await fetch(`${FMP}?${params.toString()}`, { next: { revalidate } });
        if (!res.ok) {
            return NextResponse.json({ rows: [] });
        }
        const raw = (await res.json()) as any;
        const arr: any[] = Array.isArray(raw) ? raw : [];

        const rows = arr
            .map((s) => {
                const price = Number(s.price) || 0;
                const div = Number(s.lastAnnualDividend) || 0;
                return {
                    symbol: s.symbol,
                    company: s.companyName ?? s.symbol,
                    sector: s.sector ?? "",
                    industry: s.industry ?? "",
                    price,
                    marketCap: Number.isFinite(Number(s.marketCap)) ? Number(s.marketCap) : null,
                    beta: s.beta != null && Number.isFinite(Number(s.beta)) ? Number(s.beta) : null,
                    dividendYield: price > 0 ? (div / price) * 100 : null,
                    volume: Number.isFinite(Number(s.volume)) ? Number(s.volume) : null,
                    exchange: s.exchangeShortName ?? "",
                };
            })
            .filter((r) => r.symbol);

        return NextResponse.json({ rows });
    } catch {
        return NextResponse.json({ rows: [] });
    }
}
