"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
    ArrowLeft, Search, TrendingUp, TrendingDown, Activity,
    Cpu, HeartPulse, Landmark, ShoppingCart, Flame, Radio, Factory,
    RefreshCw, ArrowUpRight, ArrowDownRight,
} from "lucide-react"
import type { StockQuote, SectorSummary } from "@/app/api/market-overview/route"
import PortfolioCard from "@/components/portfolio-card"

// ─── Sector config (icon + metadata) ──────────────────────────────────────────

const SECTOR_ICONS: Record<string, React.ReactNode> = {
    technology:    <Cpu className="h-4 w-4" />,
    healthcare:    <HeartPulse className="h-4 w-4" />,
    financials:    <Landmark className="h-4 w-4" />,
    consumer:      <ShoppingCart className="h-4 w-4" />,
    energy:        <Flame className="h-4 w-4" />,
    communication: <Radio className="h-4 w-4" />,
    industrials:   <Factory className="h-4 w-4" />,
}

// Tailwind color strings per sector (must be complete strings for purge)
const SECTOR_COLORS: Record<string, { active: string; badge: string; bar: string; ring: string }> = {
    blue:    { active: "bg-blue-600 text-white border-blue-600",    badge: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",    bar: "bg-blue-500",    ring: "ring-blue-500" },
    emerald: { active: "bg-emerald-600 text-white border-emerald-600", badge: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300", bar: "bg-emerald-500", ring: "ring-emerald-500" },
    violet:  { active: "bg-violet-600 text-white border-violet-600",  badge: "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300",  bar: "bg-violet-500",  ring: "ring-violet-500" },
    orange:  { active: "bg-orange-600 text-white border-orange-600",  badge: "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300",  bar: "bg-orange-500",  ring: "ring-orange-500" },
    amber:   { active: "bg-amber-600 text-white border-amber-600",    badge: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",    bar: "bg-amber-500",    ring: "ring-amber-500" },
    indigo:  { active: "bg-indigo-600 text-white border-indigo-600",  badge: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",  bar: "bg-indigo-500",  ring: "ring-indigo-500" },
    slate:   { active: "bg-slate-600 text-white border-slate-600",    badge: "bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300",    bar: "bg-slate-500",    ring: "ring-slate-500" },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
    return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtPct(n: number) {
    return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`
}

function fmtChange(n: number) {
    return `${n >= 0 ? "+" : ""}$${Math.abs(n).toFixed(2)}`
}

function changeClass(n: number) {
    return n > 0 ? "text-emerald-600 dark:text-emerald-400" : n < 0 ? "text-red-500 dark:text-red-400" : "text-muted-foreground"
}

function changeBadgeClass(n: number) {
    return n > 0
        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
        : n < 0
        ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400"
        : "bg-muted text-muted-foreground"
}

function timeAgo(ts: number) {
    const secs = Math.floor((Date.now() - ts) / 1000)
    if (secs < 60) return `${secs}s ago`
    const mins = Math.floor(secs / 60)
    return `${mins}m ago`
}

// ─── Stock logo with fallback ──────────────────────────────────────────────────

function Logo({ symbol, size = 40 }: { symbol: string; size?: number }) {
    const [err, setErr] = useState(false)
    const colors = ["bg-blue-600", "bg-violet-600", "bg-emerald-600", "bg-orange-600", "bg-rose-600", "bg-cyan-600", "bg-amber-600"]
    const color = colors[symbol.charCodeAt(0) % colors.length]

    if (err) {
        return (
            <div
                className={`${color} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0`}
                style={{ width: size, height: size, fontSize: size * 0.38 }}
            >
                {symbol.charAt(0)}
            </div>
        )
    }
    return (
        <img
            src={`https://financialmodelingprep.com/image-stock/${symbol}.png`}
            alt={symbol}
            width={size}
            height={size}
            className="rounded-full border border-border bg-white object-contain flex-shrink-0"
            onError={() => setErr(true)}
        />
    )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function StockCard({ stock, onClick }: { stock: StockQuote; onClick: () => void }) {
    const pos = stock.changesPercentage >= 0
    return (
        <button
            onClick={onClick}
            className="group p-4 rounded-xl border border-border bg-background hover:bg-muted/60 hover:border-border/80 hover:shadow-md transition-all text-left w-full"
        >
            <div className="flex items-start justify-between mb-3">
                <Logo symbol={stock.symbol} size={44} />
                <span className={`text-xs font-semibold px-2 py-1 rounded-full flex items-center gap-0.5 ${changeBadgeClass(stock.changesPercentage)}`}>
                    {pos ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {Math.abs(stock.changesPercentage).toFixed(2)}%
                </span>
            </div>
            <div className="space-y-0.5">
                <p className="font-bold text-sm tracking-wide">{stock.symbol}</p>
                <p className="text-xs text-muted-foreground truncate leading-tight">{stock.name}</p>
            </div>
            <div className="mt-2 pt-2 border-t border-border/50">
                <p className="font-bold text-base">${fmt(stock.price)}</p>
                <p className={`text-xs font-medium ${changeClass(stock.change)}`}>
                    {fmtChange(stock.change)} today
                </p>
            </div>
            <div className="mt-2 flex gap-1 text-xs text-muted-foreground">
                <span>H: ${fmt(stock.high)}</span>
                <span className="text-border">|</span>
                <span>L: ${fmt(stock.low)}</span>
            </div>
        </button>
    )
}

function MoverRow({ stock, rank, maxPct }: { stock: StockQuote; rank: number; maxPct: number }) {
    const pos = stock.changesPercentage >= 0
    const barPct = maxPct > 0 ? (Math.abs(stock.changesPercentage) / maxPct) * 100 : 0

    return (
        <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors rounded-lg cursor-pointer group">
            <span className="text-muted-foreground text-sm font-mono w-5 text-center flex-shrink-0">{rank}</span>
            <Logo symbol={stock.symbol} size={36} />
            <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                    <span className="font-bold text-sm">{stock.symbol}</span>
                    <span className="text-xs text-muted-foreground truncate">{stock.name}</span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                    <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all ${pos ? "bg-emerald-500" : "bg-red-500"}`}
                            style={{ width: `${barPct}%` }}
                        />
                    </div>
                </div>
            </div>
            <div className="text-right flex-shrink-0 space-y-0.5">
                <p className="font-bold text-sm">${fmt(stock.price)}</p>
                <p className={`text-xs font-semibold ${changeClass(stock.changesPercentage)}`}>
                    {fmtChange(stock.change)} ({fmtPct(stock.changesPercentage)})
                </p>
            </div>
            <div className="text-right flex-shrink-0 min-w-[60px] text-xs text-muted-foreground space-y-0.5">
                <p>H: ${fmt(stock.high)}</p>
                <p>L: ${fmt(stock.low)}</p>
            </div>
        </div>
    )
}

// ─── Types ─────────────────────────────────────────────────────────────────────

interface MarketData {
    stocks: StockQuote[]
    gainers: StockQuote[]
    losers: StockQuote[]
    mostActive: StockQuote[]
    sectorSummary: SectorSummary[]
    timestamp: number
}

interface SearchResult {
    "1. symbol": string
    "2. name": string
}

interface InvestingOptionsProps {
    onBack: () => void
    onSelect: (option: "stocks" | "bonds" | "safe-investments", symbol?: string) => void
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function InvestingOptions({ onBack, onSelect }: InvestingOptionsProps) {
    const [data, setData] = useState<MarketData | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [activeSector, setActiveSector] = useState("technology")
    const [moverTab, setMoverTab] = useState<"gainers" | "losers" | "mostActive">("gainers")

    const [searchTerm, setSearchTerm] = useState("")
    const [searchResults, setSearchResults] = useState<SearchResult[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [showResults, setShowResults] = useState(false)
    const searchRef = useRef<HTMLDivElement>(null)

    const fetchData = useCallback(async () => {
        setIsLoading(true)
        setError(null)
        try {
            const res = await fetch("/api/market-overview")
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || "Failed to load market data")
            setData(json)
        } catch (e: any) {
            setError(e.message)
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => { fetchData() }, [fetchData])

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setShowResults(false)
            }
        }
        document.addEventListener("mousedown", handler)
        return () => document.removeEventListener("mousedown", handler)
    }, [])

    const handleSearch = async () => {
        if (!searchTerm.trim()) return
        setIsSearching(true)
        setShowResults(true)
        setSearchResults([])
        try {
            const res = await fetch(`/api/stock-search?keywords=${encodeURIComponent(searchTerm)}`)
            const json = await res.json()
            if (!res.ok) throw new Error(json.error)
            setSearchResults(json)
        } catch {
            setSearchResults([])
        } finally {
            setIsSearching(false)
        }
    }

    const handleSelectStock = (symbol: string) => {
        setShowResults(false)
        setSearchTerm("")
        setSearchResults([])
        onSelect("stocks", symbol)
    }

    // Derived data
    const sectorStocks = data?.stocks.filter(s => {
        const sectorMap: Record<string, string> = {
            technology: "Technology", healthcare: "Healthcare", financials: "Financials",
            consumer: "Consumer", energy: "Energy", communication: "Communication", industrials: "Industrials",
        }
        return s.sector === sectorMap[activeSector]
    }) ?? []

    const activeSectorSummary = data?.sectorSummary.find(s => s.id === activeSector)
    const activeSectorColor = SECTOR_COLORS[activeSectorSummary?.color ?? "blue"]

    const currentMovers = moverTab === "gainers" ? data?.gainers : moverTab === "losers" ? data?.losers : data?.mostActive
    const maxPct = currentMovers ? Math.max(...currentMovers.map(s => Math.abs(s.changesPercentage))) : 1

    return (
        <div className="space-y-6">

            {/* ── Search ── */}
            <div ref={searchRef} className="relative">
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            className="pl-9"
                            placeholder="Search any stock by name or ticker — e.g. Apple, TSLA"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && handleSearch()}
                        />
                    </div>
                    <Button onClick={handleSearch} disabled={isSearching} className="bg-blue-600 hover:bg-blue-700">
                        <Search className="h-4 w-4 mr-2" />
                        {isSearching ? "Searching…" : "Search"}
                    </Button>
                </div>
                {showResults && (
                    <div className="absolute z-20 top-full mt-1 w-full bg-background border border-border rounded-xl shadow-xl max-h-72 overflow-y-auto">
                        {isSearching && <p className="p-4 text-sm text-muted-foreground">Searching…</p>}
                        {!isSearching && searchResults.length === 0 && (
                            <p className="p-4 text-sm text-muted-foreground">No results found.</p>
                        )}
                        {searchResults.map(r => (
                            <button
                                key={r["1. symbol"]}
                                onClick={() => handleSelectStock(r["1. symbol"])}
                                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-muted transition-colors text-left border-b border-border/50 last:border-0"
                            >
                                <Logo symbol={r["1. symbol"]} size={32} />
                                <div>
                                    <p className="font-bold text-sm">{r["1. symbol"]}</p>
                                    <p className="text-xs text-muted-foreground">{r["2. name"]}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Header row ── */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" onClick={onBack}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold">Market Overview</h1>
                        <p className="text-xs text-muted-foreground">
                            {data ? `Updated ${timeAgo(data.timestamp)} · ${data.stocks.length} securities` : "Loading live data…"}
                        </p>
                    </div>
                </div>
                <Button variant="outline" size="sm" onClick={fetchData} disabled={isLoading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
                    Refresh
                </Button>
            </div>

            {error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 text-destructive px-4 py-3 text-sm">
                    {error}
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════════
                  BROWSE BY INDUSTRY  +  PORTFOLIO
            ════════════════════════════════════════════════════════════════════ */}
            <div className="grid grid-cols-3 gap-6 items-start">
            <Card className="overflow-hidden col-span-2">
                <CardHeader className="pb-4 border-b border-border">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-lg">Browse by Industry</CardTitle>
                            <p className="text-sm text-muted-foreground mt-0.5">
                                Average sector performance based on today's top holdings
                            </p>
                        </div>
                        {activeSectorSummary && (
                            <div className="text-right">
                                <p className="text-xs text-muted-foreground">Sector avg</p>
                                <p className={`text-lg font-bold ${changeClass(activeSectorSummary.avgChange)}`}>
                                    {fmtPct(activeSectorSummary.avgChange)}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Sector pills */}
                    <div className="flex flex-wrap gap-2 mt-4">
                        {data?.sectorSummary.map(sector => {
                            const isActive = sector.id === activeSector
                            const colors = SECTOR_COLORS[sector.color]
                            return (
                                <button
                                    key={sector.id}
                                    onClick={() => setActiveSector(sector.id)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-all ${
                                        isActive
                                            ? colors.active
                                            : "border-border text-foreground hover:bg-muted"
                                    }`}
                                >
                                    {SECTOR_ICONS[sector.id]}
                                    {sector.name}
                                    <span className={`ml-0.5 text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                                        isActive ? "bg-white/20 text-white" : changeBadgeClass(sector.avgChange)
                                    }`}>
                                        {fmtPct(sector.avgChange)}
                                    </span>
                                </button>
                            )
                        })}
                        {isLoading && !data && (
                            <div className="flex gap-2">
                                {Array.from({ length: 7 }).map((_, i) => (
                                    <div key={i} className="h-8 w-28 rounded-full bg-muted animate-pulse" />
                                ))}
                            </div>
                        )}
                    </div>
                </CardHeader>

                <CardContent className="pt-5">
                    {isLoading && !data ? (
                        <div className="grid grid-cols-2 gap-4">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />
                            ))}
                        </div>
                    ) : sectorStocks.length > 0 ? (
                        <div className="grid grid-cols-2 gap-4">
                            {sectorStocks.map(stock => (
                                <StockCard
                                    key={stock.symbol}
                                    stock={stock}
                                    onClick={() => handleSelectStock(stock.symbol)}
                                />
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground py-6 text-center">No data available for this sector.</p>
                    )}
                </CardContent>
            </Card>

            {/* Portfolio (Plaid) sits beside Browse by Industry */}
            <div className="col-span-1">
                <PortfolioCard />
            </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════════
                  MARKET MOVERS
            ════════════════════════════════════════════════════════════════════ */}
            <Card className="overflow-hidden">
                <CardHeader className="pb-0 border-b border-border">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <CardTitle className="text-lg">Market Movers</CardTitle>
                            <p className="text-sm text-muted-foreground mt-0.5">
                                Top performers across 42 tracked securities
                            </p>
                        </div>
                        {/* Movers legend */}
                        <div className="flex gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-emerald-500" /> Gaining</span>
                            <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-red-500" /> Losing</span>
                        </div>
                    </div>

                    {/* Tab switcher */}
                    <div className="flex gap-1">
                        {([
                            { key: "gainers",    label: "Top Gainers",   icon: <TrendingUp className="h-3.5 w-3.5" /> },
                            { key: "losers",     label: "Top Losers",    icon: <TrendingDown className="h-3.5 w-3.5" /> },
                            { key: "mostActive", label: "Most Active",   icon: <Activity className="h-3.5 w-3.5" /> },
                        ] as const).map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setMoverTab(tab.key)}
                                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                                    moverTab === tab.key
                                        ? "border-blue-600 text-blue-600"
                                        : "border-transparent text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                {tab.icon}
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </CardHeader>

                <CardContent className="pt-2 px-2">
                    {/* Column headers */}
                    <div className="flex items-center gap-3 px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border/50">
                        <span className="w-5 text-center flex-shrink-0">#</span>
                        <span className="w-9 flex-shrink-0" />
                        <span className="flex-1">Company</span>
                        <span className="flex-shrink-0 min-w-[120px] text-right">Price / Change</span>
                        <span className="min-w-[60px] flex-shrink-0 text-right">Day Range</span>
                    </div>

                    {isLoading && !data ? (
                        <div className="space-y-2 pt-2">
                            {Array.from({ length: 8 }).map((_, i) => (
                                <div key={i} className="h-14 rounded-lg bg-muted animate-pulse mx-2" />
                            ))}
                        </div>
                    ) : currentMovers && currentMovers.length > 0 ? (
                        <div className="divide-y divide-border/30">
                            {currentMovers.map((stock, i) => (
                                <div key={stock.symbol} onClick={() => handleSelectStock(stock.symbol)}>
                                    <MoverRow stock={stock} rank={i + 1} maxPct={maxPct} />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground py-8 text-center">No data available.</p>
                    )}

                    {/* Summary footer */}
                    {data && (
                        <div className="mt-3 mx-4 pt-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
                            <span>
                                {data.gainers.length} gainers · {data.losers.length} losers · {data.stocks.length} total tracked
                            </span>
                            <span>Prices delayed ~15 min · Source: Finnhub</span>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
