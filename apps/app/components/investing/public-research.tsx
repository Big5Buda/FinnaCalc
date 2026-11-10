"use client"
import Link from "next/link"
import { useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { useWatchlist } from "@/components/providers/watchlist-provider"
import { Button } from "@/components/ui/primitives"
import { PageBar, PageBody } from "@/components/shell/surface"
import { TradingViewWidget, MarketDisplayNote } from "./tradingview-widget"
import { HoldingEditor } from "./manual-portfolio"
import { researchHref } from "@/lib/tradingview"
import { researchSymbol, holdingSymbol } from "@/lib/manual-portfolio"
import { CURATED_ETFS, SECTORS, sectorById } from "@/lib/investing/catalog"
import { visibleInvestingNavigation } from "@/lib/website-review"

export function ResearchSearch() {
    const [query, setQuery] = useState("")
    const [error, setError] = useState(false)
    const router = useRouter()
    return <form className="flex flex-wrap gap-3" onSubmit={event => { event.preventDefault(); const valid = researchSymbol(query); if (!valid) { setError(true); return } setError(false); router.push(researchHref(valid)) }}>
        <label className="sr-only" htmlFor="research-ticker">Stock or ETF ticker</label><input id="research-ticker" value={query} onChange={event => { setQuery(event.target.value); setError(false) }} maxLength={30} placeholder="Enter a ticker, such as AAPL" className="min-w-0 flex-1 rounded-xl border border-border bg-card px-4 py-3 text-sm" />
        <Button type="submit">Research</Button>{error && <p role="alert" className="w-full text-sm text-destructive">Enter a stock ticker, optionally with its exchange, such as NASDAQ:AAPL.</p>}
    </form>
}
function PublicPage({ title, children }: { title: string; children: ReactNode }) {
    return <><PageBar title={title} back={title === "Investing" ? undefined : { href: "/investing", label: "Investing" }} /><PageBody className="flex flex-col gap-6">{children}<MarketDisplayNote /></PageBody></>
}
export function PublicInvestingResearch() {
    return <PublicPage title="Investing"><ResearchSearch /><nav aria-label="Investing tools" className="flex flex-wrap gap-2">{visibleInvestingNavigation.map(item => <Link key={item.href} href={item.href} className="rounded-full border border-border px-3 py-2 text-sm font-medium">{item.label}</Link>)}</nav>
        <TradingViewWidget kind="overview" title="Market overview" height={530} />
        <section><h2 className="mb-4 text-xl font-semibold">Explore sectors</h2><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">{SECTORS.map(sector => <Link key={sector.id} href={`/investing/sectors/${sector.id}`} className="rounded-xl p-4 text-white" style={{ backgroundColor: sector.color }}><span className="font-semibold">{sector.name}</span><p className="mt-2 text-xs text-white/90">{sector.blurb}</p></Link>)}</div></section>
        <TradingViewWidget kind="news" title="Market news" height={450} />
    </PublicPage>
}
export function PublicStockResearch({ symbol }: { symbol: string }) {
    const watchlist = useWatchlist()
    const valid = researchSymbol(symbol)
    if (!valid) return <PublicPage title="Stock research"><p>That ticker is not valid.</p><ResearchSearch /></PublicPage>
    const ticker = holdingSymbol(valid)!
    return <PublicPage title={ticker}><div className="flex flex-wrap items-center justify-between gap-4"><h2 className="text-2xl font-semibold">{valid}</h2><div className="flex gap-3"><HoldingEditor symbol={ticker} /><Button type="button" variant="outline" disabled={!watchlist.ready} onClick={() => watchlist.toggle(ticker)}>{watchlist.contains(ticker) ? "Remove from watchlist" : "Add to watchlist"}</Button></div></div>
        <ResearchSearch /><TradingViewWidget kind="info" symbol={valid} title="Symbol details" height={230} /><TradingViewWidget kind="chart" symbol={valid} title="Price chart" height={540} />
        <div className="grid gap-5 lg:grid-cols-2"><TradingViewWidget kind="profile" symbol={valid} title="Company profile" height={420} /><TradingViewWidget kind="financials" symbol={valid} title="Fundamentals" height={420} /></div>
    </PublicPage>
}
export function PublicWatchlist() {
    const watchlist = useWatchlist()
    const [adding, setAdding] = useState("")
    const [error, setError] = useState(false)
    return <PublicPage title="Watchlist"><p className="text-sm text-muted-foreground">{watchlist.saved === null ? "A starter list you can change." : "Your saved list."} Symbols stay in this browser, without an account.</p><form className="flex gap-3" onSubmit={event => { event.preventDefault(); const ticker = holdingSymbol(adding); if (!ticker) { setError(true); return } watchlist.add(ticker); setAdding(""); setError(false) }}><input aria-label="Add a symbol to your watchlist" value={adding} onChange={event => setAdding(event.target.value)} placeholder="Add a ticker" maxLength={30} className="min-w-0 flex-1 rounded-lg border border-border bg-card px-4 py-2" /><Button type="submit" disabled={!watchlist.ready}>Add</Button></form>{error && <p role="alert" className="text-sm text-destructive">Enter a valid US stock or ETF ticker.</p>}
        {!watchlist.ready ? <p role="status">Loading your watchlist…</p> : watchlist.symbols.length === 0 ? <p>Your watchlist is empty. Add a ticker above.</p> : <ul className="divide-y divide-border rounded-xl border border-border bg-card">{watchlist.symbols.map(symbol => <li key={symbol} className="flex items-center justify-between gap-4 p-4"><Link className="font-semibold text-primary" href={researchHref(symbol)}>{symbol}</Link><div className="flex flex-wrap gap-3"><Link className="rounded-lg border border-border px-3 py-2 text-sm" href={researchHref(symbol)}>View chart &amp; details</Link><Button type="button" variant="outline" onClick={() => watchlist.remove(symbol)}>Remove</Button></div></li>)}</ul>}
    </PublicPage>
}
const SECTOR_ETF: Record<string, string> = { technology: "XLK", healthcare: "XLV", financials: "XLF", consumer: "XLY", energy: "XLE", communication: "XLC", industrials: "XLI" }
export function PublicSectorResearch({ sector }: { sector: string }) {
    const meta = sectorById(sector)
    if (!meta) return <PublicPage title="Sector"><p>Sector not found.</p></PublicPage>
    const symbol = SECTOR_ETF[sector]
    return <PublicPage title={meta.name}><p className="text-sm text-muted-foreground">{meta.blurb} The chart below shows {symbol}, a sector ETF; it is not the return of every company in the sector.</p><Link className="font-medium text-primary" href={researchHref(symbol)}>Explore {symbol}</Link><TradingViewWidget kind="chart" symbol={symbol} title={`${meta.name} sector ETF chart`} height={540} /><ResearchSearch /></PublicPage>
}
export function PublicEtfs() {
    return <PublicPage title="ETFs & index funds"><ResearchSearch /><TradingViewWidget kind="overview" title="Market overview" height={500} /><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{CURATED_ETFS.map(etf => <Link key={etf.symbol} href={researchHref(etf.symbol)} className="rounded-xl border border-border bg-card p-5"><p className="font-semibold">{etf.symbol}</p><p className="mt-1 text-sm text-muted-foreground">{etf.name}</p></Link>)}</div></PublicPage>
}
export function PublicScreener() {
    return <PublicPage title="Screener"><ResearchSearch /><TradingViewWidget kind="screener" title="US stock screener" height={650} /></PublicPage>
}
