import { NextResponse } from "next/server";
import { activeAssets, isAlpacaConfigured, movers } from "@/lib/alpaca";

// The day's biggest gainers and losers, from Alpaca's own movers screener —
// the whole market, not a hand-picked watchlist scored against itself, which is
// what this route used to do.

export const revalidate = 300;

export async function GET() {
    if (!isAlpacaConfigured) {
        return NextResponse.json({ error: "Market data is not configured." }, { status: 503 });
    }

    try {
        const [{ gainers, losers }, assets] = await Promise.all([movers(10, revalidate), activeAssets()]);
        const names = new Map(assets.map((entry) => [entry.symbol, entry.name]));

        const shape = (rows: { symbol: string; price: number; change: number; percent_change: number }[]) =>
            rows.slice(0, 5).map((row) => ({
                symbol: row.symbol,
                // Alpaca's screener has no company name, so it comes from the
                // asset list; the symbol stands in when it isn't listed.
                name: names.get(row.symbol) ?? row.symbol,
                price: row.price,
                change: row.change,
                changesPercentage: row.percent_change,
            }));

        return NextResponse.json({ topGainers: shape(gainers), topLosers: shape(losers) });
    } catch (err: any) {
        return NextResponse.json({ error: err.message || "Failed to fetch market data." }, { status: 500 });
    }
}
