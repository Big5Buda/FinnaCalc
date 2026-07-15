// Retired-ticker → successor resolution.
//
// When a company is renamed or acquired its old ticker stops resolving at
// every data provider, so a lookup for it returns nothing and the app renders
// a blank page (e.g. PARA after Paramount Global became Paramount Skydance).
// This resolves such a symbol to the live successor so the quote and chart
// routes can serve it, and callers can explain the swap.
//
// Two layers, in priority order:
//
//  1. CURATED — a hand-verified map. Authoritative, and the only source for
//     ACQUISITIONS (a symbol-change feed tracks tickers that were renamed; it
//     does not know that Xilinx was absorbed into AMD, because XLNX wasn't
//     renamed, it ceased to exist).
//  2. FEED — FMP's symbol-change list, fetched and cached. Self-updating, so
//     future renames resolve without a code change. Best-effort: if the
//     endpoint is unavailable (plan-gated, network), the curated layer still
//     answers and nothing regresses.
//
// SAFETY — the rules any entry must satisfy, curated or from the feed:
//
//   * The old symbol must really be dead. Exchanges RE-ISSUE retired tickers
//     to unrelated companies, so a stale mapping sends users to the WRONG
//     stock. Verified live while building the curated list: FB is now a
//     ProShares ETF (not Meta), STI is Solidion Technology (not SunTrust),
//     BBT is Beacon Financial (not BB&T), LB is LandBridge (not L Brands),
//     INFO is a Harbor ETF (not IHS Markit). None may be aliased. Callers
//     therefore only consult this resolver AFTER a live quote lookup has
//     already come back empty — a symbol that still trades never reaches here.
//   * The successor must be live. FISV → FI looks obvious but is backwards:
//     the provider still serves FISV, and FI returns nothing.
//
// Symbols that died with no successor (SIVB, FRC, CTXS, AABA — bankrupt,
// taken private, wound down) are deliberately absent: there is nowhere honest
// to send the user, so the caller's normal "no data" response stands.

const FMP_KEY = process.env.FMP_API_KEY;

export type AliasKind = "renamed" | "acquired";

export type SymbolAlias = {
    /// The retired symbol that was requested.
    from: string;
    /// The live symbol to serve instead.
    to: string;
    kind: AliasKind;
    /// Human-readable explanation for the client banner.
    note: string;
    /// Which layer answered — surfaced for observability.
    source: "curated" | "feed";
};

type CuratedEntry = {
    to: string;
    kind: AliasKind;
    formerName: string;
    successorName: string;
};

// Each entry verified against the live API: old symbol dead, successor live.
const CURATED: Record<string, CuratedEntry> = {
    // — Renames / reorganizations (same shareholders, new ticker) —
    // CBS + Viacom → ViacomCBS → Paramount Global (PARA) → Paramount Skydance.
    PARA: { to: "PSKY", kind: "renamed", formerName: "Paramount Global", successorName: "Paramount Skydance Corp" },
    VIAB: { to: "PSKY", kind: "renamed", formerName: "Viacom", successorName: "Paramount Skydance Corp" },
    CBS: { to: "PSKY", kind: "renamed", formerName: "CBS Corporation", successorName: "Paramount Skydance Corp" },
    ANTM: { to: "ELV", kind: "renamed", formerName: "Anthem", successorName: "Elevance Health Inc" },
    WLTW: { to: "WTW", kind: "renamed", formerName: "Willis Towers Watson", successorName: "Willis Towers Watson PLC" },
    MYL: { to: "VTRS", kind: "renamed", formerName: "Mylan", successorName: "Viatris Inc." },
    DISCA: { to: "WBD", kind: "renamed", formerName: "Discovery", successorName: "Warner Bros Discovery Inc" },
    RTN: { to: "RTX", kind: "renamed", formerName: "Raytheon Company", successorName: "RTX Corp" },

    // — Acquisitions (absorbed into another company; no feed tracks these) —
    ZNGA: { to: "TTWO", kind: "acquired", formerName: "Zynga", successorName: "Take-Two Interactive" },
    XLNX: { to: "AMD", kind: "acquired", formerName: "Xilinx", successorName: "Advanced Micro Devices" },
    NUAN: { to: "MSFT", kind: "acquired", formerName: "Nuance Communications", successorName: "Microsoft" },
    ALXN: { to: "AZN", kind: "acquired", formerName: "Alexion Pharmaceuticals", successorName: "AstraZeneca" },
    FLIR: { to: "TDY", kind: "acquired", formerName: "FLIR Systems", successorName: "Teledyne Technologies" },
    AGN: { to: "ABBV", kind: "acquired", formerName: "Allergan", successorName: "AbbVie" },
    CELG: { to: "BMY", kind: "acquired", formerName: "Celgene", successorName: "Bristol-Myers Squibb" },
    PXD: { to: "XOM", kind: "acquired", formerName: "Pioneer Natural Resources", successorName: "Exxon Mobil" },
    HES: { to: "CVX", kind: "acquired", formerName: "Hess Corporation", successorName: "Chevron" },
    VMW: { to: "AVGO", kind: "acquired", formerName: "VMware", successorName: "Broadcom" },
    CERN: { to: "ORCL", kind: "acquired", formerName: "Cerner", successorName: "Oracle" },
};

function curatedNote(e: CuratedEntry): string {
    return e.kind === "renamed"
        ? `${e.formerName} now trades as ${e.to}.`
        : `${e.formerName} was acquired by ${e.successorName} (${e.to}).`;
}

// ── Feed layer (FMP symbol-change) ──────────────────────────────────────────

type FeedMap = Map<string, string>; // oldSymbol → newSymbol

let feedCache: { map: FeedMap; at: number } | null = null;
const FEED_TTL_MS = 24 * 60 * 60 * 1000; // renames are rare; refresh daily

/**
 * old→new ticker changes from FMP. Best-effort: any failure (unset key,
 * plan-gated endpoint, network, unexpected shape) yields an empty map, and the
 * curated layer carries the resolution. Tolerant of both the `stable` and `v4`
 * response forms since the account's plan decides which is served.
 */
async function fetchFeed(): Promise<FeedMap> {
    if (feedCache && Date.now() - feedCache.at < FEED_TTL_MS) return feedCache.map;
    const map: FeedMap = new Map();
    if (!FMP_KEY) {
        feedCache = { map, at: Date.now() };
        return map;
    }

    const urls = [
        `https://financialmodelingprep.com/stable/symbol-change?apikey=${FMP_KEY}`,
        `https://financialmodelingprep.com/api/v4/symbol_change?apikey=${FMP_KEY}`,
    ];
    for (const url of urls) {
        try {
            const res = await fetch(url, { next: { revalidate: 86400 } });
            if (!res.ok) continue;
            const rows = await res.json();
            if (!Array.isArray(rows)) continue; // e.g. {"Error Message": ...}
            for (const row of rows) {
                const from = String(row?.oldSymbol ?? "").toUpperCase().trim();
                const to = String(row?.newSymbol ?? "").toUpperCase().trim();
                // Skip malformed rows and self-references.
                if (!from || !to || from === to) continue;
                map.set(from, to);
            }
            if (map.size > 0) break;
        } catch {
            // try the next form
        }
    }
    feedCache = { map, at: Date.now() };
    return map;
}

/**
 * Walks the feed's rename chain to the final symbol (CBS → VIAC → PARA → PSKY).
 * Cycle-guarded and hop-capped, since a bad feed row could otherwise loop.
 */
function followChain(symbol: string, feed: FeedMap): string {
    let current = symbol;
    const seen = new Set([current]);
    for (let hop = 0; hop < 5; hop++) {
        const next = feed.get(current);
        if (!next || seen.has(next)) break;
        seen.add(next);
        current = next;
    }
    return current;
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * The successor for a retired ticker, or null when the symbol has no honest
 * one. Only call this AFTER a live quote lookup has returned nothing — a
 * symbol that still trades must never be redirected (retired tickers get
 * re-issued to unrelated companies).
 */
export async function resolveRetiredSymbol(symbol: string): Promise<SymbolAlias | null> {
    const from = symbol.toUpperCase().trim();
    if (!from) return null;

    const curated = CURATED[from];
    if (curated) {
        return {
            from,
            to: curated.to,
            kind: curated.kind,
            note: curatedNote(curated),
            source: "curated",
        };
    }

    const feed = await fetchFeed();
    const to = followChain(from, feed);
    if (to === from) return null;
    return {
        from,
        to,
        kind: "renamed", // the feed only tracks ticker changes, never acquisitions
        note: `${from} now trades as ${to}.`,
        source: "feed",
    };
}
