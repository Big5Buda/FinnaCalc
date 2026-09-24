import { NextRequest, NextResponse } from "next/server";
import { companyNames } from "@/lib/investing/names";
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
// can actually answer: pick a universe from Alpaca's own screener endpoints,
// the day's most active symbols, its biggest gainers, or its biggest losers,
// then filter and rank that universe on the numbers a snapshot carries.
//
// A preset used to BE the universe, which meant asking for no preset was
// asking for nothing, and the app showed an empty screen to anyone who only
// wanted to filter on price. With no preset the universe is now all three
// lists merged and deduplicated, about 190 symbols on a normal day and never
// more than 200, since Alpaca caps most-actives at 100 and movers at 50 a
// side. That is the widest universe this data plan can reach. It is still
// nowhere near every US stock, so the response says `preset: null` and the
// app names the list rather than implying a market-wide sweep.
//
// The merged case sorts before it truncates. The three presets arrive already
// ranked, by volume or by percent change, so iterating them in order and
// stopping at `limit` gives the top of that ranking. A merge has no such
// order: concatenated, the first 60 are simply the most-active 60, and the
// gainers and losers behind them would never be reached.
//
// `sort` and `dir` say how to rank before that cut. The app asks for them on
// every request, because ranking is what its category chips now do: they no
// longer choose a universe, they choose how this one is read. Ranking only
// the rows that survived a cut made on some other column would answer a
// different question than the one the chip asks, so the rank happens here,
// across the whole universe, and the cut happens after it.
//
//   sort=changePct|volume|relVolume|price|symbol   dir=asc|desc
//
// Both are optional. Without them a preset keeps its own order and a merge
// falls back to volume, which is what every build before this one expects.
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
// The merged universe roughly doubles the upstream work and the payload, and
// this route had no ceiling of its own while its siblings set 30.
export const maxDuration = 30;

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
        // 503, like every sibling route. The status is load-bearing: Next
        // prerenders a cacheable 200 at build time, where the credentials are
        // not visible, and then serves that frozen "not configured" body for
        // as long as the deployment lives — which is exactly what happened.
        // A non-200 is never cached, so a misconfiguration can report itself
        // instead of outliving the fix.
        return NextResponse.json(
            { rows: [], error: "Screener not configured — add ALPACA_API_KEY_ID." },
            { status: 503 },
        );
    }

    const params = request.nextUrl.searchParams;
    const presetParam = params.get("preset");
    // Only an ABSENT or empty preset merges the lists. An unrecognized value
    // still falls back to actives, so a typo cannot silently hand back a
    // different screen than the one that was asked for.
    const merged = presetParam === null || presetParam.trim() === "";
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

    const SORTABLE = ["changePct", "volume", "relVolume", "price", "symbol"] as const;
    type SortKey = (typeof SORTABLE)[number];
    const sortParam = params.get("sort");
    const sortKey: SortKey | null =
        sortParam !== null && (SORTABLE as readonly string[]).includes(sortParam)
            ? (sortParam as SortKey)
            : null;
    const ascending = params.get("dir") === "asc";
    // A ranking has to see every row before it can pick a top, so the early
    // break below is only safe when the universe already arrives in order.
    const rankHere = merged || sortKey !== null;

    const asked = UNSUPPORTED.filter((key) => params.get(key));

    try {
        let symbols: string[] = [];
        if (merged) {
            // One extra upstream call, not two: a single movers request
            // already returns both sides, and the preset branch below has
            // always thrown one of them away.
            const [actives, both] = await Promise.all([
                mostActives(UNIVERSE, "volume", revalidate),
                movers(50, revalidate),
            ]);
            const seen = new Set<string>();
            for (const entry of [...actives, ...both.gainers, ...both.losers]) {
                if (entry.symbol && !seen.has(entry.symbol)) {
                    seen.add(entry.symbol);
                    symbols.push(entry.symbol);
                }
            }
        } else if (preset === "actives") {
            symbols = (await mostActives(UNIVERSE, "volume", revalidate)).map((entry) => entry.symbol);
        } else {
            const { gainers, losers } = await movers(50, revalidate);
            symbols = (preset === "gainers" ? gainers : losers).map((entry) => entry.symbol);
        }
        if (symbols.length === 0) {
            return NextResponse.json({
                rows: [],
                preset: merged ? null : preset,
                universeSize: 0,
                unsupported: asked,
            });
        }

        // Daily bars back a month give the session average relVolume needs;
        // 32 calendar days covers ~21 sessions through weekends and holidays.
        //
        // The budget is scaled by the symbol count because Alpaca applies
        // `limit` to the WHOLE multi-symbol response rather than per symbol,
        // and pages the remainder behind a token. Its own API reference is
        // blunt about it ("The limit applies to the total number of data
        // points, not per symbol!") and warns that results come back sorted by
        // symbol, so the alphabetically first names eat the whole allowance. A
        // flat 25 bought twenty-five bars for the entire call: on a live
        // hundred-symbol universe AAL took 23 of them and AAPL took the
        // remaining 2, the other 98 rows carried a null avgVolume and
        // relVolume, and relVolumeMoreThan therefore dropped all but those two.
        // /api/sparklines hit this first and was fixed the same way. 100
        // symbols at 25 bars each is 2,500, inside the endpoint's documented
        // ceiling of 10,000, so nothing here needs to follow the page token.
        const BARS_PER_SYMBOL = 25;
        const start = new Date(Date.now() - 32 * 24 * 60 * 60 * 1000);
        const [snapshots, assets, history] = await Promise.all([
            stockSnapshots(symbols, revalidate),
            activeAssets(),
            multiBars(symbols, "1Day", start, BARS_PER_SYMBOL * symbols.length, revalidate),
        ]);
        const info = new Map(assets.map((entry) => [entry.symbol, entry]));
        // Resolved for the whole universe up front rather than per surviving
        // row: the SEC ticker file is fetched once and cached for a day, so
        // the size of this list costs nothing beyond map lookups. Alpaca's
        // asset list stays as the fallback, and it is empty in production
        // today, which is why this column showed the ticker as the company.
        const resolvedNames = await companyNames(symbols);

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
                company: resolvedNames[symbol] ?? asset?.name ?? symbol,
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
            // A preset's own order is its ranking, so the first `limit` rows
            // that clear the filters are the top of it and the rest of the
            // universe cannot beat them. The merge has no inherent order, so
            // it has to see every row before it can pick a top.
            if (!rankHere && rows.length >= limit) break;
        }

        if (sortKey === "symbol") {
            rows.sort((a, b) => (ascending ? 1 : -1) * a.symbol.localeCompare(b.symbol));
        } else if (sortKey !== null) {
            // A missing number is not a zero and must not win "smallest", so
            // it sorts last whichever way the column is pointing. Same rule
            // the app applies to the rows it already has.
            rows.sort((a, b) => {
                const left = a[sortKey];
                const right = b[sortKey];
                if (left === null && right === null) return 0;
                if (left === null) return 1;
                if (right === null) return -1;
                return (ascending ? 1 : -1) * (left - right);
            });
        } else if (merged) {
            rows.sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));
        }

        return NextResponse.json({
            rows: rows.slice(0, limit),
            // Null, never a string the app has no case for: the iOS client
            // decodes this into an enum with a plain JSONDecoder, and an
            // unrecognized value throws on the WHOLE response rather than on
            // one field, which would empty the screen instead of one label.
            preset: merged ? null : preset,
            universeSize: symbols.length,
            asOf: new Date().toISOString(),
            ...(asked.length > 0 ? { unsupported: asked } : {}),
        });
    } catch (err: any) {
        return NextResponse.json({
            rows: [],
            preset: merged ? null : preset,
            error: err.message || "Screener failed.",
        });
    }
}
