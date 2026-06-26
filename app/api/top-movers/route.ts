import { NextResponse } from "next/server";

export const revalidate = 60;

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
const BASE_URL = "https://finnhub.io/api/v1";

const WATCHLIST = [
    { symbol: "AAPL", name: "Apple Inc." },
    { symbol: "MSFT", name: "Microsoft Corp." },
    { symbol: "NVDA", name: "NVIDIA Corp." },
    { symbol: "AMZN", name: "Amazon.com Inc." },
    { symbol: "GOOGL", name: "Alphabet Inc." },
    { symbol: "META", name: "Meta Platforms Inc." },
    { symbol: "TSLA", name: "Tesla Inc." },
    { symbol: "JPM", name: "JPMorgan Chase & Co." },
    { symbol: "V", name: "Visa Inc." },
    { symbol: "JNJ", name: "Johnson & Johnson" },
    { symbol: "XOM", name: "Exxon Mobil Corp." },
    { symbol: "DIS", name: "Walt Disney Co." },
    { symbol: "NFLX", name: "Netflix Inc." },
    { symbol: "AMD", name: "Advanced Micro Devices" },
    { symbol: "BAC", name: "Bank of America Corp." },
];

export async function GET() {
    if (!FINNHUB_API_KEY) {
        return NextResponse.json({ error: "Finnhub API key not configured." }, { status: 500 });
    }

    try {
        const quotes = await Promise.all(
            WATCHLIST.map(async ({ symbol, name }) => {
                const res = await fetch(
                    `${BASE_URL}/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`,
                    { next: { revalidate: 60 } }
                );
                if (!res.ok) return null;
                const data = await res.json();
                if (!data.c || data.c === 0) return null;
                return {
                    symbol,
                    name,
                    price: data.c,
                    change: data.d,
                    changesPercentage: data.dp,
                };
            })
        );

        const valid = quotes.filter(Boolean) as NonNullable<(typeof quotes)[number]>[];
        valid.sort((a, b) => b!.changesPercentage - a!.changesPercentage);

        const topGainers = valid.filter(q => q!.changesPercentage > 0).slice(0, 5);
        const topLosers = [...valid].reverse().filter(q => q!.changesPercentage < 0).slice(0, 5);

        return NextResponse.json({ topGainers, topLosers });
    } catch (err: any) {
        return NextResponse.json({ error: err.message || "Failed to fetch market data." }, { status: 500 });
    }
}
