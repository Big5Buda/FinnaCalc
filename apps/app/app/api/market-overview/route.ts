import { NextResponse } from "next/server";
import { isAlpacaConfigured, snapshotChange, snapshotPrice, stockSnapshots } from "@/lib/alpaca";
import { SECTOR_UNIVERSE as SECTORS } from "@/lib/investing/catalog";

// Sector overview: one batched Alpaca snapshot call for the whole universe.
// Symbols Alpaca has no snapshot for are dropped rather than shown at zero, so
// a sector's average only ever averages real quotes.

export const revalidate = 60;


export interface StockQuote {
    symbol: string;
    name: string;
    sector: string;
    sectorColor: string;
    price: number;
    change: number;
    changesPercentage: number;
    /** Shares traded today on IEX, the one venue this feed sees. */
    volume: number;
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
                volume: snapshot?.dailyBar?.v ?? 0,
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

        // By shares traded, which is what "most active" means. This used to
        // sort by absolute percentage move, so the card the app labelled
        // "Most Active" with the blurb "the most-traded stocks on the market
        // right now" was a third movers list and the blurb was false on both
        // halves. The volume is IEX's alone — one venue, well below the
        // consolidated tape — and the app's copy says so.
        const mostActive = [...stocks]
            .sort((a, b) => b.volume - a.volume)
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
