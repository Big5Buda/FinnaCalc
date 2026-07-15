import { NextRequest, NextResponse } from "next/server";
import { resolveRetiredSymbol } from "@/lib/symbol-resolver";
import { fetchQuote } from "@/lib/quotes";

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
const BASE_URL = "https://finnhub.io/api/v1";

// Returns parsed JSON, or null on any failure (network, non-OK, premium-gated).
// This keeps a single endpoint failing (e.g. a premium-only metric) from
// taking down the whole stock lookup.
async function fhSafe(path: string): Promise<any | null> {
    try {
        const res = await fetch(`${BASE_URL}${path}&token=${FINNHUB_API_KEY}`, {
            next: { revalidate: 60 },
        });
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

const FMP_KEY = process.env.FMP_API_KEY;

// FMP company profile — the only free source of a REAL business description
// (plus CEO / employees / sector). Best-effort.
async function fmpProfile(symbol: string): Promise<any | null> {
    if (!FMP_KEY) return null;
    const urls = [
        `https://financialmodelingprep.com/stable/profile?symbol=${encodeURIComponent(symbol)}&apikey=${FMP_KEY}`,
        `https://financialmodelingprep.com/api/v3/profile/${encodeURIComponent(symbol)}?apikey=${FMP_KEY}`,
    ];
    for (const url of urls) {
        try {
            const res = await fetch(url, { next: { revalidate: 3600 } });
            if (!res.ok) continue;
            const arr = await res.json();
            if (Array.isArray(arr) && arr.length > 0) return arr[0];
        } catch {
            // try the next form
        }
    }
    return null;
}

function num(v: any): number | null {
    return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/// Everything one symbol needs, or null when the symbol has no live price
/// anywhere (delisted, renamed, or simply unknown).
async function fetchSymbol(symbol: string) {
    // NB: /stock/candle is intentionally omitted — it's a paid-only Finnhub
    // endpoint (returns 403 on the free tier); the native chart pulls
    // /api/candles (Twelve Data) instead.
    //
    // fetchQuote handles the Finnhub → FMP fallback (Finnhub's free tier can't
    // quote indices or crypto); see lib/quotes.ts.
    const [priceSrc, profileData, metricsData, fmp] = await Promise.all([
        fetchQuote(symbol),
        fhSafe(`/stock/profile2?symbol=${symbol}`),
        fhSafe(`/stock/metric?symbol=${symbol}&metric=all`),
        fmpProfile(symbol),
    ]);

    if (!priceSrc) return null;
    return { priceSrc, profileData, metricsData, fmp };
}

export async function GET(request: NextRequest) {
    if (!FINNHUB_API_KEY) {
        return NextResponse.json({ error: "Finnhub API key not configured." }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const requested = searchParams.get("symbol")?.toUpperCase();
    if (!requested) {
        return NextResponse.json({ error: "Symbol is required." }, { status: 400 });
    }

    try {
        let symbol = requested;
        let fetched = await fetchSymbol(symbol);

        // Nothing anywhere for this symbol — it may be a retired ticker whose
        // company was renamed or acquired (PARA → PSKY). Resolving is only
        // safe here, AFTER a live lookup came back empty: retired tickers get
        // re-issued to unrelated companies, so a symbol that still trades must
        // never be redirected.
        let alias: Awaited<ReturnType<typeof resolveRetiredSymbol>> = null;
        if (!fetched) {
            alias = await resolveRetiredSymbol(symbol);
            if (alias) {
                const successor = await fetchSymbol(alias.to);
                // Only adopt the successor if it actually has data; otherwise
                // report the original miss rather than a second dead end.
                if (successor) {
                    symbol = alias.to;
                    fetched = successor;
                } else {
                    alias = null;
                }
            }
        }

        if (!fetched) {
            return NextResponse.json({ error: `No data found for symbol "${requested}".` }, { status: 404 });
        }
        const { priceSrc, profileData, metricsData, fmp } = fetched;

        const profile = profileData ?? {};
        const m = metricsData?.metric ?? {};

        const quote = {
            "01. symbol": symbol,
            "05. price": String(priceSrc.price),
            "09. change": String(priceSrc.change),
            "10. change percent": `${priceSrc.changePct}%`,
        };

        // Prefer FMP's real business description over the synthesized line.
        const realDescription = typeof fmp?.description === "string" && fmp.description.length > 0
            ? fmp.description
            : null;
        const fallbackDescription = profile.finnhubIndustry
            ? `${profile.name} operates in the ${profile.finnhubIndustry} industry.${profile.weburl ? ` Learn more at ${profile.weburl}.` : ""}`
            : "No description available.";

        const marketCapRaw = profile.marketCapitalization;
        const overview = {
            Name: profile.name || fmp?.companyName || priceSrc.name || symbol,
            MarketCapitalization: marketCapRaw
                ? String(Math.round(marketCapRaw * 1_000_000))
                : "0",
            Description: realDescription ?? fallbackDescription,
            Logo: profile.logo || "",
            PERatio: m.peTTM != null ? String(m.peTTM.toFixed(2)) : "N/A",
        };

        // Extended stats (Finnhub /stock/metric, free tier) + profile facts.
        const stats = {
            high52: num(m["52WeekHigh"]),
            low52: num(m["52WeekLow"]),
            beta: num(m.beta),
            epsTTM: num(m.epsTTM) ?? num(m.epsInclExtraItemsTTM),
            dividendYield: num(m.dividendYieldIndicatedAnnual) ?? num(m.currentDividendYieldTTM),
            netMargin: num(m.netProfitMarginTTM),
            revenueGrowth: num(m.revenueGrowthTTMYoy),
            grossMargin: num(m.grossMarginTTM),
            sharesOutstanding: num(profile.shareOutstanding), // millions
        };

        const company = {
            exchange: profile.exchange ?? null,
            industry: profile.finnhubIndustry ?? fmp?.industry ?? null,
            sector: fmp?.sector ?? null,
            ceo: fmp?.ceo ?? null,
            employees: fmp?.fullTimeEmployees != null ? String(fmp.fullTimeEmployees) : null,
            ipo: profile.ipo ?? fmp?.ipoDate ?? null,
            website: profile.weburl ?? fmp?.website ?? null,
            country: profile.country ?? null,
        };

        // `alias` is present only when the requested ticker was retired and
        // this payload is its successor — the client shows it as a banner.
        return NextResponse.json({ quote, overview, stats, company, alias });
    } catch (err: any) {
        return NextResponse.json({ error: err.message || "Failed to fetch stock data." }, { status: 500 });
    }
}
