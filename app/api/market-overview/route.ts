import { NextResponse } from "next/server";
import { isAlpacaConfigured, snapshotChange, snapshotPrice, stockSnapshots } from "@/lib/alpaca";

// Sector overview: one batched Alpaca snapshot call for the whole universe.
// Symbols Alpaca has no snapshot for are dropped rather than shown at zero, so
// a sector's average only ever averages real quotes.

export const revalidate = 60;

const SECTORS = [
    {
        id: "technology", name: "Technology", color: "blue",
        stocks: [
            { symbol: "AAPL", name: "Apple Inc." }, { symbol: "MSFT", name: "Microsoft Corp." },
            { symbol: "NVDA", name: "NVIDIA Corp." }, { symbol: "GOOGL", name: "Alphabet Inc." },
            { symbol: "META", name: "Meta Platforms Inc." }, { symbol: "AMD", name: "Advanced Micro Devices" },
            { symbol: "AVGO", name: "Broadcom Inc." }, { symbol: "ORCL", name: "Oracle Corp." },
            { symbol: "CRM", name: "Salesforce Inc." }, { symbol: "ADBE", name: "Adobe Inc." },
            { symbol: "INTC", name: "Intel Corp." }, { symbol: "CSCO", name: "Cisco Systems" },
            { symbol: "QCOM", name: "Qualcomm Inc." }, { symbol: "TXN", name: "Texas Instruments" },
            { symbol: "IBM", name: "IBM Corp." },
        ],
    },
    {
        id: "healthcare", name: "Healthcare", color: "emerald",
        stocks: [
            { symbol: "UNH", name: "UnitedHealth Group" }, { symbol: "JNJ", name: "Johnson & Johnson" },
            { symbol: "LLY", name: "Eli Lilly and Co." }, { symbol: "ABBV", name: "AbbVie Inc." },
            { symbol: "MRK", name: "Merck & Co." }, { symbol: "PFE", name: "Pfizer Inc." },
            { symbol: "TMO", name: "Thermo Fisher Scientific" }, { symbol: "ABT", name: "Abbott Laboratories" },
            { symbol: "DHR", name: "Danaher Corp." }, { symbol: "AMGN", name: "Amgen Inc." },
            { symbol: "BMY", name: "Bristol-Myers Squibb" }, { symbol: "GILD", name: "Gilead Sciences" },
            { symbol: "ISRG", name: "Intuitive Surgical" }, { symbol: "CVS", name: "CVS Health" },
            { symbol: "MDT", name: "Medtronic plc" },
        ],
    },
    {
        id: "financials", name: "Financials", color: "violet",
        stocks: [
            { symbol: "JPM", name: "JPMorgan Chase & Co." }, { symbol: "BAC", name: "Bank of America Corp." },
            { symbol: "V", name: "Visa Inc." }, { symbol: "MA", name: "Mastercard Inc." },
            { symbol: "GS", name: "Goldman Sachs Group" }, { symbol: "WFC", name: "Wells Fargo & Co." },
            { symbol: "MS", name: "Morgan Stanley" }, { symbol: "BLK", name: "BlackRock Inc." },
            { symbol: "C", name: "Citigroup Inc." }, { symbol: "AXP", name: "American Express" },
            { symbol: "SCHW", name: "Charles Schwab" }, { symbol: "USB", name: "U.S. Bancorp" },
            { symbol: "PNC", name: "PNC Financial" }, { symbol: "COF", name: "Capital One" },
            { symbol: "PYPL", name: "PayPal Holdings" },
        ],
    },
    {
        id: "consumer", name: "Consumer", color: "orange",
        stocks: [
            { symbol: "AMZN", name: "Amazon.com Inc." }, { symbol: "TSLA", name: "Tesla Inc." },
            { symbol: "HD", name: "Home Depot Inc." }, { symbol: "MCD", name: "McDonald's Corp." },
            { symbol: "NKE", name: "Nike Inc." }, { symbol: "SBUX", name: "Starbucks Corp." },
            { symbol: "LOW", name: "Lowe's Companies" }, { symbol: "TGT", name: "Target Corp." },
            { symbol: "COST", name: "Costco Wholesale" }, { symbol: "WMT", name: "Walmart Inc." },
            { symbol: "PG", name: "Procter & Gamble" }, { symbol: "KO", name: "Coca-Cola Co." },
            { symbol: "PEP", name: "PepsiCo Inc." }, { symbol: "BKNG", name: "Booking Holdings" },
            { symbol: "TJX", name: "TJX Companies" },
        ],
    },
    {
        id: "energy", name: "Energy", color: "amber",
        stocks: [
            { symbol: "XOM", name: "Exxon Mobil Corp." }, { symbol: "CVX", name: "Chevron Corp." },
            { symbol: "COP", name: "ConocoPhillips" }, { symbol: "SLB", name: "Schlumberger Ltd." },
            { symbol: "OXY", name: "Occidental Petroleum" }, { symbol: "PSX", name: "Phillips 66" },
            { symbol: "EOG", name: "EOG Resources" }, { symbol: "MPC", name: "Marathon Petroleum" },
            { symbol: "VLO", name: "Valero Energy" }, { symbol: "KMI", name: "Kinder Morgan" },
            { symbol: "WMB", name: "Williams Companies" }, { symbol: "HAL", name: "Halliburton Co." },
            { symbol: "DVN", name: "Devon Energy" }, { symbol: "HES", name: "Hess Corp." },
            { symbol: "BKR", name: "Baker Hughes" },
        ],
    },
    {
        id: "communication", name: "Communication", color: "indigo",
        stocks: [
            { symbol: "NFLX", name: "Netflix Inc." }, { symbol: "DIS", name: "Walt Disney Co." },
            { symbol: "T", name: "AT&T Inc." }, { symbol: "VZ", name: "Verizon Communications" },
            { symbol: "CMCSA", name: "Comcast Corp." }, { symbol: "CHTR", name: "Charter Communications" },
            { symbol: "TMUS", name: "T-Mobile US" }, { symbol: "SPOT", name: "Spotify Technology" },
            { symbol: "EA", name: "Electronic Arts" }, { symbol: "TTWO", name: "Take-Two Interactive" },
            { symbol: "WBD", name: "Warner Bros. Discovery" }, { symbol: "PARA", name: "Paramount Global" },
            { symbol: "RBLX", name: "Roblox Corp." }, { symbol: "LYV", name: "Live Nation" },
            { symbol: "OMC", name: "Omnicom Group" },
        ],
    },
    {
        id: "industrials", name: "Industrials", color: "slate",
        stocks: [
            { symbol: "CAT", name: "Caterpillar Inc." }, { symbol: "BA", name: "Boeing Co." },
            { symbol: "GE", name: "GE Aerospace" }, { symbol: "UPS", name: "United Parcel Service" },
            { symbol: "HON", name: "Honeywell International" }, { symbol: "LMT", name: "Lockheed Martin Corp." },
            { symbol: "RTX", name: "RTX Corp." }, { symbol: "DE", name: "Deere & Co." },
            { symbol: "UNP", name: "Union Pacific" }, { symbol: "FDX", name: "FedEx Corp." },
            { symbol: "ETN", name: "Eaton Corp." }, { symbol: "EMR", name: "Emerson Electric" },
            { symbol: "NOC", name: "Northrop Grumman" }, { symbol: "GD", name: "General Dynamics" },
            { symbol: "MMM", name: "3M Co." },
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
    if (!isAlpacaConfigured) {
        return NextResponse.json({ error: "Market data is not configured." }, { status: 503 });
    }

    try {
        const allSymbols = SECTORS.flatMap(sector =>
            sector.stocks.map(stock => ({
                ...stock,
                sector: sector.name,
                sectorColor: sector.color,
            }))
        );

        // One batched snapshot call covers all 105 symbols; individual quotes
        // per symbol would be 105 requests for one page.
        const snapshots = await stockSnapshots(allSymbols.map((s) => s.symbol), 120);

        const stocks: StockQuote[] = allSymbols.flatMap(({ symbol, name, sector, sectorColor }) => {
            const snapshot = snapshots[symbol];
            const price = snapshotPrice(snapshot);
            if (price === null) return [];
            const move = snapshotChange(snapshot);
            const previousClose = snapshot?.prevDailyBar?.c;
            return [{
                symbol,
                name,
                sector,
                sectorColor,
                price,
                change: move?.change ?? 0,
                changesPercentage: move?.changePct ?? 0,
                high: snapshot?.dailyBar?.h ?? price,
                low: snapshot?.dailyBar?.l ?? price,
                open: snapshot?.dailyBar?.o ?? price,
                previousClose: typeof previousClose === "number" && previousClose > 0 ? previousClose : price,
                // Logos came from a vendor image CDN that went with the rest of
                // them; the client falls back to its own mark on an empty string.
                logo: "",
            } as StockQuote];
        });

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
