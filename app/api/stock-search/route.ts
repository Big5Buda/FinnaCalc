import { NextRequest, NextResponse } from "next/server";

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
const BASE_URL = "https://finnhub.io/api/v1";

export async function GET(request: NextRequest) {
    if (!FINNHUB_API_KEY) {
        return NextResponse.json({ error: "Finnhub API key not configured." }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const keywords = searchParams.get("keywords");
    if (!keywords) {
        return NextResponse.json({ error: "Keywords are required." }, { status: 400 });
    }

    try {
        const res = await fetch(
            `${BASE_URL}/search?q=${encodeURIComponent(keywords)}&token=${FINNHUB_API_KEY}`
        );
        if (!res.ok) throw new Error(`Finnhub error: ${res.status}`);
        const data = await res.json();

        const results = (data.result || [])
            .filter((item: any) => item.type === "Common Stock" && !item.symbol.includes("."))
            .slice(0, 10)
            .map((item: any) => ({
                "1. symbol": item.symbol,
                "2. name": item.description,
                "4. region": "United States",
            }));

        return NextResponse.json(results);
    } catch (err: any) {
        return NextResponse.json({ error: err.message || "Search failed." }, { status: 500 });
    }
}
