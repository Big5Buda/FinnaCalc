import { NextRequest, NextResponse } from "next/server";
import {
    activeAssets,
    isAlpacaConfigured,
    mostActives,
    snapshotChange,
    snapshotPrice,
    stockSnapshots,
} from "@/lib/alpaca";

// Stock screener, on Alpaca.
//
// Alpaca screens by activity, not by fundamentals: its screener returns the
// day's most-active symbols, and everything else here is derived from their
// snapshots. That is a narrower tool than the market-wide fundamental screen
// this route used to run, and the difference is reported rather than hidden —
// `unsupported` lists the filters that no longer mean anything, and the fields
// behind them come back null instead of zero.
//
// Supported: priceMoreThan, priceLowerThan, volumeMoreThan, volumeLowerThan,
// changeMoreThan, changeLowerThan, limit.
//
// Response: { rows: ScreenerRow[], unsupported?: string[], error?: string }

export const revalidate = 300;

export interface ScreenerRow {
    symbol: string;
    company: string;
    sector: string;
    industry: string;
    price: number;
    marketCap: number | null;
    beta: number | null;
    dividendYield: number | null;
    volume: number | null;
    exchange: string;
}

/** Filters that needed a fundamentals vendor and have no Alpaca equivalent. */
const UNSUPPORTED = [
    "marketCapMoreThan",
    "marketCapLowerThan",
    "betaMoreThan",
    "betaLowerThan",
    "dividendMoreThan",
    "dividendLowerThan",
    "sector",
    "industry",
];

function num(params: URLSearchParams, key: string): number | null {
    const raw = params.get(key);
    if (raw === null || raw.trim() === "") return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
}

export async function GET(request: NextRequest) {
    if (!isAlpacaConfigured) {
        return NextResponse.json({ rows: [], error: "Screener not configured — add ALPACA_API_KEY_ID." });
    }

    const params = request.nextUrl.searchParams;
    const limit = Math.min(Math.max(num(params, "limit") ?? 50, 1), 100);
    const priceMin = num(params, "priceMoreThan");
    const priceMax = num(params, "priceLowerThan");
    const volumeMin = num(params, "volumeMoreThan");
    const volumeMax = num(params, "volumeLowerThan");
    const changeMin = num(params, "changeMoreThan");
    const changeMax = num(params, "changeLowerThan");

    const asked = UNSUPPORTED.filter((key) => params.get(key));

    try {
        const actives = await mostActives(100, "volume", revalidate);
        if (actives.length === 0) {
            return NextResponse.json({ rows: [], unsupported: asked });
        }

        const symbols = actives.map((entry) => entry.symbol);
        const [snapshots, assets] = await Promise.all([
            stockSnapshots(symbols, revalidate),
            activeAssets(),
        ]);
        const names = new Map(assets.map((entry) => [entry.symbol, entry]));

        const rows: ScreenerRow[] = [];
        for (const active of actives) {
            const snapshot = snapshots[active.symbol];
            const price = snapshotPrice(snapshot);
            if (price === null) continue;
            const move = snapshotChange(snapshot);
            const volume = snapshot?.dailyBar?.v ?? active.volume ?? null;

            if (priceMin !== null && price < priceMin) continue;
            if (priceMax !== null && price > priceMax) continue;
            if (volumeMin !== null && (volume ?? 0) < volumeMin) continue;
            if (volumeMax !== null && (volume ?? 0) > volumeMax) continue;
            if (changeMin !== null && (move?.changePct ?? 0) < changeMin) continue;
            if (changeMax !== null && (move?.changePct ?? 0) > changeMax) continue;

            const info = names.get(active.symbol);
            rows.push({
                symbol: active.symbol,
                company: info?.name ?? active.symbol,
                // Alpaca classifies assets by exchange and class, not by GICS
                // sector, so these stay empty rather than being invented.
                sector: "",
                industry: "",
                price,
                marketCap: null,
                beta: null,
                dividendYield: null,
                volume,
                exchange: info?.exchange ?? "",
            });
            if (rows.length >= limit) break;
        }

        return NextResponse.json(asked.length > 0 ? { rows, unsupported: asked } : { rows });
    } catch (err: any) {
        return NextResponse.json({ rows: [], error: err.message || "Screener failed." });
    }
}
