import { CURATED_ETFS, SECTOR_UNIVERSE, SECTORS } from "./catalog"
import { researchSymbol } from "../manual-portfolio"

export type ResearchEntry = { symbol: string; name: string; sector: string; kind: "stock" | "fund" }
// Editorial company metadata, never quotes. Sector ETFs are listed separately.
const omitted = new Set(["HES", "PARA", "WBD"])
const communication = new Set(["GOOGL", "META"])
export const RESEARCH_CATALOG: ResearchEntry[] = [
    ...SECTOR_UNIVERSE.flatMap(group => group.stocks.filter(stock => !omitted.has(stock.symbol)).map(stock => ({ ...stock, sector: communication.has(stock.symbol) ? "communication" : group.id, kind: "stock" as const }))),
    { symbol: "GOOG", name: "Alphabet Inc. (Class C)", sector: "communication", kind: "stock" },
    { symbol: "BRK.B", name: "Berkshire Hathaway Inc. (Class B)", sector: "financials", kind: "stock" },
    ...CURATED_ETFS.map(fund => ({ symbol: fund.symbol, name: fund.name, sector: "funds", kind: "fund" as const })),
]
export function researchEntry(symbol: string) { return RESEARCH_CATALOG.find(entry => entry.symbol === symbol.toUpperCase().split(":").at(-1)) }
export function sectorStocks(sector: string) { return RESEARCH_CATALOG.filter(entry => entry.kind === "stock" && entry.sector === sector) }
const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "")
export function searchResearch(query: string) {
    const raw = query.trim().toUpperCase()
    const key = normalize(query)
    if (!key) return []
    return RESEARCH_CATALOG.filter(entry => entry.symbol.includes(raw) || normalize(entry.name).includes(key))
        .sort((a, b) => Number(b.symbol === raw) - Number(a.symbol === raw) || Number(b.symbol.startsWith(raw)) - Number(a.symbol.startsWith(raw)) || a.symbol.localeCompare(b.symbol))
        .slice(0, 8)
}
export function resolveResearch(query: string): string | null {
    const results = searchResearch(query)
    const exact = results.find(entry => entry.symbol === query.trim().toUpperCase() || normalize(entry.name) === normalize(query))
    if (exact) return exact.symbol
    if (results.length === 1) return results[0].symbol
    if (results.length > 1) return null
    const ticker = researchSymbol(query)
    // Unlisted tickers still work; company names must resolve to a result.
    return ticker && /^(?:(?:NASDAQ|NYSE|AMEX|NYSEARCA|CBOE|BATS):)?[A-Z][A-Z0-9.\-]{0,5}$/.test(ticker) ? ticker : null
}
export function holdingSector(symbol: string) {
    const entry = researchEntry(symbol)
    if (!entry) return { id: "unknown", name: "Unclassified", color: "#64748b" }
    if (entry.kind === "fund") return { id: "funds", name: "Funds / ETFs", color: "#64748b" }
    return SECTORS.find(sector => sector.id === entry.sector) ?? { id: "unknown", name: "Unclassified", color: "#64748b" }
}
