import { NextRequest, NextResponse } from "next/server";
import {
    activeAssets,
    isAlpacaConfigured,
    mostActives,
    movers,
    multiBars,
    snapshotChange,
    snapshotPrice,
    stockSnapshots,
    type AlpacaBar,
} from "@/lib/alpaca";

// Stock screener, on Alpaca.
//
// Alpaca screens by ACTIVITY, not fundamentals, so this route follows what it
// can actually answer: pick a universe from Alpaca's own screener endpoints —
// the day's most active symbols, its biggest gainers, or its biggest losers —
// then filter and rank that universe on the numbers a snapshot carries.
//
// Everything returned is measured, never inferred:
//   price / change / changePct    snapshot against the previous session's close
//   volume                        today's bar
//   avgVolume / relVolume         today's volume against the mean of the last
//                                 completed sessions (one batched bars call)
//   dayHigh / dayLow / prevClose  today's bar and the last session's close
//
// What a fundamentals vendor used to supply — sector, market cap, beta,
// dividend yield, P/E — went with those vendors. Filters naming them come back
// in `unsupported` rather than being silently dropped, and the fields are
// absent rather than null-shaped placeholders pretending to be data.
//
// Response: { rows, preset, universeSize, asOf, unsupported?, error? }

export const revalidate = 300;

export type ScreenerPreset = "actives" | "gainers" | "losers";

export interface ScreenerRow {
    symbol: string;
    company: string;
    exchange: string;
    price: number;
    change: number | null;
    changePct: number | null;
    volume: number | null;
    avgVolume: number | null;
    /** Today's volume ÷ the recent session average. 1.0 is a typical day. */
    relVolume: number | null;
    dayHigh: number | null;
    dayLow: number | null;
    prevClose: number | null;
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

/** How many symbols a preset pulls before filtering. */
const UNIVERSE = 100;

function num(params: URLSearchParams, key: string): number | null {
    const raw = params.get(key);
    if (raw === null || raw.trim() === "") return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
}

/** Mean volume of the completed sessions in a series, today's bar excluded. */
function averageVolume(series: AlpacaBar[] | undefined): number | null {
    if (!series || series.length < 2) return null;
    const volumes = series
        .slice(0, -1)
        .map((bar) => bar.v)
        .filter((v) => typeof v === "number" && v > 0);
    if (volumes.length === 0) return null;
    return volumes.reduce((sum, v) => sum + v, 0) / volumes.length;
}

export async function GET(request: NextRequest) {
    if (!isAlpacaConfigured) {
        return NextResponse.json({ rows: [], error: "Screener not configured — add ALPACA_API_KEY_ID." });
    }

    const params = request.nextUrl.searchParams;
    const presetParam = params.get("preset");
    const preset: ScreenerPreset =
        presetParam === "gainers" || presetParam === "losers" ? presetParam : "actives";

    const limit = Math.min(Math.max(num(params, "limit") ?? 50, 1), 100);
    const priceMin = num(params, "priceMoreThan");
    const priceMax = num(params, "priceLowerThan");
    const volumeMin = num(params, "volumeMoreThan");
    const volumeMax = num(params, "volumeLowerThan");
    const changeMin = num(params, "changeMoreThan");
    const changeMax = num(params, "changeLowerThan");
    const relVolumeMin = num(params, "relVolumeMoreThan");

    const asked = UNSUPPORTED.filter((key) => params.get(key));

    try {
        let symbols: string[] = [];
        if (preset === "actives") {
            symbols = (await mostActives(UNIVERSE, "volume", revalidate)).map((entry) => entry.symbol);
        } else {
            const { gainers, losers } = await movers(50, revalidate);
            symbols = (preset === "gainers" ? gainers : losers).map((entry) => entry.symbol);
        }
        if (symbols.length === 0) {
            return NextResponse.json({ rows: [], preset, universeSize: 0, unsupported: asked });
        }

        // Daily bars back a month give the session average relVolume needs;
        // 32 calendar days covers ~21 sessions through weekends and holidays.
        const start = new Date(Date.now() - 32 * 24 * 60 * 60 * 1000);
        const [snapshots, assets, history] = await Promise.all([
            stockSnapshots(symbols, revalidate),
            activeAssets(),
            multiBars(symbols, "1Day", start, 25, revalidate),
        ]);
        const info = new Map(assets.map((entry) => [entry.symbol, entry]));

        const rows: ScreenerRow[] = [];
        for (const symbol of symbols) {
            const snapshot = snapshots[symbol];
            const price = snapshotPrice(snapshot);
            if (price === null) continue;

            const move = snapshotChange(snapshot);
            const volume = snapshot?.dailyBar?.v ?? null;
            const avgVolume = averageVolume(history[symbol]);
            const relVolume =
                volume !== null && avgVolume !== null && avgVolume > 0 ? volume / avgVolume : null;

            if (priceMin !== null && price < priceMin) continue;
            if (priceMax !== null && price > priceMax) continue;
            if (volumeMin !== null && (volume ?? 0) < volumeMin) continue;
            if (volumeMax !== null && (volume ?? 0) > volumeMax) continue;
            if (changeMin !== null && (move?.changePct ?? 0) < changeMin) continue;
            if (changeMax !== null && (move?.changePct ?? 0) > changeMax) continue;
            // A symbol with no history can't prove it cleared a relative-volume
            // floor, so it drops out rather than being assumed to have.
            if (relVolumeMin !== null && (relVolume ?? 0) < relVolumeMin) continue;

            const asset = info.get(symbol);
            rows.push({
                symbol,
                company: asset?.name ?? symbol,
                exchange: asset?.exchange ?? "",
                price,
                change: move?.change ?? null,
                changePct: move?.changePct ?? null,
                volume,
                avgVolume,
                relVolume,
                dayHigh: snapshot?.dailyBar?.h ?? null,
                dayLow: snapshot?.dailyBar?.l ?? null,
                prevClose: snapshot?.prevDailyBar?.c ?? null,
            });
            if (rows.length >= limit) break;
        }

        return NextResponse.json({
            rows,
            preset,
            universeSize: symbols.length,
            asOf: new Date().toISOString(),
            ...(asked.length > 0 ? { unsupported: asked } : {}),
        });
    } catch (err: any) {
        return NextResponse.json({ rows: [], preset, error: err.message || "Screener failed." });
    }
}
