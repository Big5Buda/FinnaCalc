import { NextResponse } from "next/server";
import { companyNames } from "@/lib/investing/names";
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

        // One resolve for every symbol on the page, so the SEC file is read
        // once rather than per row. Alpaca's asset list stays as a fallback:
        // it is empty in production today, which is why these rows showed the
        // ticker in the company column.
        const resolved = await companyNames([...gainers, ...losers].map((row) => row.symbol));

        const shape = (rows: { symbol: string; price: number; change: number; percent_change: number }[]) =>
            rows.slice(0, 5).map((row) => ({
                symbol: row.symbol,
                // Alpaca's screener has no company name, so it comes from the
                // asset list; the symbol stands in when it isn't listed.
                name: resolved[row.symbol] ?? names.get(row.symbol) ?? row.symbol,
                price: row.price,
                change: row.change,
                changesPercentage: row.percent_change,
            }));

        return NextResponse.json({ topGainers: shape(gainers), topLosers: shape(losers) });
    } catch (err: any) {
        return NextResponse.json({ error: err.message || "Failed to fetch market data." }, { status: 500 });
    }
}
