import { NextRequest, NextResponse } from "next/server";

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
const BASE_URL = "https://finnhub.io/api/v1";

async function fh(path: string) {
    const res = await fetch(`${BASE_URL}${path}&token=${FINNHUB_API_KEY}`, {
        next: { revalidate: 60 },
    });
    if (!res.ok) throw new Error(`Finnhub error: ${res.status}`);
    return res.json();
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
        const now = Math.floor(Date.now() / 1000);
        const thirtyDaysAgo = now - 30 * 24 * 60 * 60;

        const [quoteData, profileData, candleData, metricsData] = await Promise.all([
            fh(`/quote?symbol=${symbol}`),
            fh(`/stock/profile2?symbol=${symbol}`),
            fh(`/stock/candle?symbol=${symbol}&resolution=D&from=${thirtyDaysAgo}&to=${now}`),
            fh(`/stock/metric?symbol=${symbol}&metric=all`),
        ]);

        if (!quoteData.c || quoteData.c === 0) {
            return NextResponse.json({ error: `No data found for symbol "${symbol}".` }, { status: 404 });
        }

        const quote = {
            "01. symbol": symbol,
            "05. price": String(quoteData.c),
            "09. change": String(quoteData.d ?? 0),
            "10. change percent": `${quoteData.dp ?? 0}%`,
        };

        const marketCapRaw = profileData.marketCapitalization;
        const overview = {
            Name: profileData.name || symbol,
            MarketCapitalization: marketCapRaw
                ? String(Math.round(marketCapRaw * 1_000_000))
                : "0",
            Description: profileData.finnhubIndustry
                ? `${profileData.name} operates in the ${profileData.finnhubIndustry} industry.${profileData.weburl ? ` Learn more at ${profileData.weburl}.` : ""}`
                : "No description available.",
            Logo: profileData.logo || "",
            PERatio: metricsData?.metric?.peTTM != null
                ? String(metricsData.metric.peTTM.toFixed(2))
                : "N/A",
        };

        const timeSeries: Record<string, { "4. close": string }> = {};
        if (candleData.s === "ok" && Array.isArray(candleData.t)) {
            candleData.t.forEach((ts: number, i: number) => {
                const date = new Date(ts * 1000).toISOString().split("T")[0];
                timeSeries[date] = { "4. close": String(candleData.c[i]) };
            });
        }

        return NextResponse.json({ quote, overview, timeSeries });
    } catch (err: any) {
        return NextResponse.json({ error: err.message || "Failed to fetch stock data." }, { status: 500 });
    }
}
