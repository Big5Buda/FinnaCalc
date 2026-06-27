import { NextRequest, NextResponse } from "next/server";

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

export async function GET(request: NextRequest) {
    if (!FINNHUB_API_KEY) {
        return NextResponse.json({ error: "Finnhub API key not configured." }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get("symbol")?.toUpperCase();
    if (!symbol) {
        return NextResponse.json({ error: "Symbol is required." }, { status: 400 });
    }

    try {
        // NB: /stock/candle is intentionally omitted — it's a paid-only Finnhub
        // endpoint (returns 403 on the free tier) and charts are now rendered
        // by TradingView directly from the symbol, so OHLC data isn't needed.
        const [quoteData, profileData, metricsData] = await Promise.all([
            fhSafe(`/quote?symbol=${symbol}`),
            fhSafe(`/stock/profile2?symbol=${symbol}`),
            fhSafe(`/stock/metric?symbol=${symbol}&metric=all`),
        ]);

        if (!quoteData || !quoteData.c || quoteData.c === 0) {
            return NextResponse.json({ error: `No data found for symbol "${symbol}".` }, { status: 404 });
        }

        const profile = profileData ?? {};

        const quote = {
            "01. symbol": symbol,
            "05. price": String(quoteData.c),
            "09. change": String(quoteData.d ?? 0),
            "10. change percent": `${quoteData.dp ?? 0}%`,
        };

        const marketCapRaw = profile.marketCapitalization;
        const overview = {
            Name: profile.name || symbol,
            MarketCapitalization: marketCapRaw
                ? String(Math.round(marketCapRaw * 1_000_000))
                : "0",
            Description: profile.finnhubIndustry
                ? `${profile.name} operates in the ${profile.finnhubIndustry} industry.${profile.weburl ? ` Learn more at ${profile.weburl}.` : ""}`
                : "No description available.",
            Logo: profile.logo || "",
            PERatio: metricsData?.metric?.peTTM != null
                ? String(metricsData.metric.peTTM.toFixed(2))
                : "N/A",
        };

        return NextResponse.json({ quote, overview });
    } catch (err: any) {
        return NextResponse.json({ error: err.message || "Failed to fetch stock data." }, { status: 500 });
    }
}
