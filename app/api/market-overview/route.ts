import { NextResponse } from "next/server";

export const revalidate = 60;

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
const BASE_URL = "https://finnhub.io/api/v1";

const SECTORS = [
    {
        id: "technology", name: "Technology", color: "blue",
        stocks: [
            { symbol: "AAPL", name: "Apple Inc." },
            { symbol: "MSFT", name: "Microsoft Corp." },
            { symbol: "NVDA", name: "NVIDIA Corp." },
            { symbol: "GOOGL", name: "Alphabet Inc." },
            { symbol: "META", name: "Meta Platforms Inc." },
            { symbol: "AMD", name: "Advanced Micro Devices" },
        ],
    },
    {
        id: "healthcare", name: "Healthcare", color: "emerald",
        stocks: [
            { symbol: "UNH", name: "UnitedHealth Group" },
            { symbol: "JNJ", name: "Johnson & Johnson" },
            { symbol: "LLY", name: "Eli Lilly and Co." },
            { symbol: "ABBV", name: "AbbVie Inc." },
            { symbol: "MRK", name: "Merck & Co." },
            { symbol: "PFE", name: "Pfizer Inc." },
        ],
    },
    {
        id: "financials", name: "Financials", color: "violet",
        stocks: [
            { symbol: "JPM", name: "JPMorgan Chase & Co." },
            { symbol: "BAC", name: "Bank of America Corp." },
            { symbol: "V", name: "Visa Inc." },
            { symbol: "MA", name: "Mastercard Inc." },
            { symbol: "GS", name: "Goldman Sachs Group" },
            { symbol: "WFC", name: "Wells Fargo & Co." },
        ],
    },
    {
        id: "consumer", name: "Consumer", color: "orange",
        stocks: [
            { symbol: "AMZN", name: "Amazon.com Inc." },
            { symbol: "TSLA", name: "Tesla Inc." },
            { symbol: "HD", name: "Home Depot Inc." },
            { symbol: "MCD", name: "McDonald's Corp." },
            { symbol: "NKE", name: "Nike Inc." },
            { symbol: "SBUX", name: "Starbucks Corp." },
        ],
    },
    {
        id: "energy", name: "Energy", color: "amber",
        stocks: [
            { symbol: "XOM", name: "Exxon Mobil Corp." },
            { symbol: "CVX", name: "Chevron Corp." },
            { symbol: "COP", name: "ConocoPhillips" },
            { symbol: "SLB", name: "Schlumberger Ltd." },
            { symbol: "OXY", name: "Occidental Petroleum" },
            { symbol: "PSX", name: "Phillips 66" },
        ],
    },
    {
        id: "communication", name: "Communication", color: "indigo",
        stocks: [
            { symbol: "NFLX", name: "Netflix Inc." },
            { symbol: "DIS", name: "Walt Disney Co." },
            { symbol: "T", name: "AT&T Inc." },
            { symbol: "VZ", name: "Verizon Communications" },
            { symbol: "CMCSA", name: "Comcast Corp." },
            { symbol: "CHTR", name: "Charter Communications" },
        ],
    },
    {
        id: "industrials", name: "Industrials", color: "slate",
        stocks: [
            { symbol: "CAT", name: "Caterpillar Inc." },
            { symbol: "BA", name: "Boeing Co." },
            { symbol: "GE", name: "GE Aerospace" },
            { symbol: "UPS", name: "United Parcel Service" },
            { symbol: "HON", name: "Honeywell International" },
            { symbol: "LMT", name: "Lockheed Martin Corp." },
        ],
    },
];

export interface StockQuote {
    symbol: string;
    name: string;
    sector: string;
    sectorColor: string;
    price: number;
    change: number;
    changesPercentage: number;
    high: number;
    low: number;
    open: number;
    previousClose: number;
    logo: string;
}

export interface SectorSummary {
    id: string;
    name: string;
    color: string;
    avgChange: number;
    stockCount: number;
}

export async function GET() {
    if (!FINNHUB_API_KEY) {
        return NextResponse.json({ error: "Finnhub API key not configured." }, { status: 500 });
    }

    try {
        const allSymbols = SECTORS.flatMap(sector =>
            sector.stocks.map(stock => ({
                ...stock,
                sector: sector.name,
                sectorColor: sector.color,
            }))
        );

        const results = await Promise.all(
            allSymbols.map(async ({ symbol, name, sector, sectorColor }) => {
                try {
                    const res = await fetch(
                        `${BASE_URL}/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`,
                        { next: { revalidate: 60 } }
                    );
                    if (!res.ok) return null;
                    const d = await res.json();
                    if (!d.c || d.c === 0) return null;
                    return {
                        symbol,
                        name,
                        sector,
                        sectorColor,
                        price: d.c,
                        change: d.d ?? 0,
                        changesPercentage: d.dp ?? 0,
                        high: d.h ?? d.c,
                        low: d.l ?? d.c,
                        open: d.o ?? d.c,
                        previousClose: d.pc ?? d.c,
                        logo: `https://financialmodelingprep.com/image-stock/${symbol}.png`,
                    } as StockQuote;
                } catch {
                    return null;
                }
            })
        );

        const stocks = results.filter(Boolean) as StockQuote[];

        const gainers = [...stocks]
            .filter(s => s.changesPercentage > 0)
            .sort((a, b) => b.changesPercentage - a.changesPercentage)
            .slice(0, 10);

        const losers = [...stocks]
            .filter(s => s.changesPercentage < 0)
            .sort((a, b) => a.changesPercentage - b.changesPercentage)
            .slice(0, 10);

        const mostActive = [...stocks]
            .sort((a, b) => Math.abs(b.changesPercentage) - Math.abs(a.changesPercentage))
            .slice(0, 10);

        const sectorSummary: SectorSummary[] = SECTORS.map(sector => {
            const sectorStocks = stocks.filter(s => s.sector === sector.name);
            const avgChange = sectorStocks.length
                ? sectorStocks.reduce((acc, s) => acc + s.changesPercentage, 0) / sectorStocks.length
                : 0;
            return {
                id: sector.id,
                name: sector.name,
                color: sector.color,
                avgChange: parseFloat(avgChange.toFixed(2)),
                stockCount: sectorStocks.length,
            };
        });

        return NextResponse.json({ stocks, gainers, losers, mostActive, sectorSummary, timestamp: Date.now() });
    } catch (err: any) {
        return NextResponse.json({ error: err.message || "Failed to fetch market data." }, { status: 500 });
    }
}
