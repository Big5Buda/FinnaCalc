"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SlidersHorizontal, ArrowUpDown } from "lucide-react"
import type { ScreenerRow } from "@/app/api/screener/route"

const SECTORS = ["All", "Technology", "Communication", "Consumer", "Financials", "Healthcare", "Energy"]
const CAP_BUCKETS = ["All", "Mega (>$200B)", "Large ($10B–$200B)", "Mid (<$10B)"]

function fmtCap(n: number | null) {
    if (n == null) return "—"
    if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
    if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
    if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`
    return `$${n}`
}

type SortKey = "symbol" | "price" | "changePercent" | "marketCap" | "peRatio" | "dividendYield"

export default function StockScreener() {
    const [rows, setRows] = useState<ScreenerRow[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const [sector, setSector] = useState("All")
    const [cap, setCap] = useState("All")
    const [minYield, setMinYield] = useState(0)
    const [sortKey, setSortKey] = useState<SortKey>("marketCap")
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

    useEffect(() => {
        let active = true
        ;(async () => {
            try {
                const res = await fetch("/api/screener")
                const json = await res.json()
                if (!res.ok) throw new Error(json.error || "Failed to load screener")
                if (active) setRows(json.rows)
            } catch (e: any) {
                if (active) setError(e.message)
            } finally {
                if (active) setLoading(false)
            }
        })()
        return () => {
            active = false
        }
    }, [])

    const filtered = useMemo(() => {
        let r = rows.filter((row) => {
            if (sector !== "All" && row.sector !== sector) return false
            if (minYield > 0 && (row.dividendYield ?? 0) < minYield) return false
            if (cap !== "All" && row.marketCap != null) {
                if (cap.startsWith("Mega") && row.marketCap < 200e9) return false
                if (cap.startsWith("Large") && (row.marketCap < 10e9 || row.marketCap >= 200e9)) return false
                if (cap.startsWith("Mid") && row.marketCap >= 10e9) return false
            }
            return true
        })
        r = [...r].sort((a, b) => {
            const av = a[sortKey], bv = b[sortKey]
            const an = typeof av === "number" ? av : av == null ? -Infinity : String(av)
            const bn = typeof bv === "number" ? bv : bv == null ? -Infinity : String(bv)
            if (an < bn) return sortDir === "asc" ? -1 : 1
            if (an > bn) return sortDir === "asc" ? 1 : -1
            return 0
        })
        return r
    }, [rows, sector, cap, minYield, sortKey, sortDir])

    const toggleSort = (key: SortKey) => {
        if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
        else {
            setSortKey(key)
            setSortDir("desc")
        }
    }

    const reset = () => {
        setSector("All")
        setCap("All")
        setMinYield(0)
        setSortKey("marketCap")
        setSortDir("desc")
    }

    const Th = ({ label, k, right }: { label: string; k: SortKey; right?: boolean }) => (
        <th className={`px-3 py-2 font-semibold ${right ? "text-right" : "text-left"}`}>
            <button onClick={() => toggleSort(k)} className={`inline-flex items-center gap-1 hover:text-foreground ${sortKey === k ? "text-foreground" : ""}`}>
                {label}
                <ArrowUpDown className="h-3 w-3 opacity-50" />
            </button>
        </th>
    )

    return (
        <Card className="overflow-hidden">
            <CardHeader className="pb-4 border-b border-border">
                <div className="flex items-center gap-2">
                    <SlidersHorizontal className="h-5 w-5 text-blue-600" />
                    <CardTitle className="text-lg">Stock Screener</CardTitle>
                </div>

                <div className="flex flex-wrap items-end gap-4 mt-4">
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Sector</label>
                        <Select value={sector} onValueChange={setSector}>
                            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {SECTORS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Market Cap</label>
                        <Select value={cap} onValueChange={setCap}>
                            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {CAP_BUCKETS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Min Div Yield: {minYield}%</label>
                        <input
                            type="range"
                            min={0}
                            max={5}
                            step={0.5}
                            value={minYield}
                            onChange={(e) => setMinYield(parseFloat(e.target.value))}
                            className="w-44 accent-blue-600 block"
                        />
                    </div>
                    <Button variant="outline" size="sm" onClick={reset}>Reset</Button>
                </div>
            </CardHeader>

            <CardContent className="p-0">
                {loading ? (
                    <div className="p-4 space-y-2">
                        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-10 rounded bg-muted animate-pulse" />)}
                    </div>
                ) : error ? (
                    <p className="p-6 text-sm text-muted-foreground text-center">{error}</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="text-xs text-muted-foreground border-b border-border bg-muted/30">
                                <tr>
                                    <Th label="Ticker" k="symbol" />
                                    <th className="px-3 py-2 font-semibold text-left">Company</th>
                                    <th className="px-3 py-2 font-semibold text-left">Sector</th>
                                    <Th label="Price" k="price" right />
                                    <Th label="% Chg" k="changePercent" right />
                                    <Th label="Mkt Cap" k="marketCap" right />
                                    <Th label="P/E" k="peRatio" right />
                                    <Th label="Div Yield" k="dividendYield" right />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/60">
                                {filtered.map((r) => (
                                    <tr key={r.symbol} className="hover:bg-muted/40 transition-colors">
                                        <td className="px-3 py-2.5 font-bold">{r.symbol}</td>
                                        <td className="px-3 py-2.5 text-muted-foreground truncate max-w-[180px]">{r.company}</td>
                                        <td className="px-3 py-2.5 text-muted-foreground">{r.sector}</td>
                                        <td className="px-3 py-2.5 text-right font-medium">${r.price.toFixed(2)}</td>
                                        <td className={`px-3 py-2.5 text-right font-semibold ${r.changePercent >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                                            {r.changePercent >= 0 ? "+" : ""}{r.changePercent.toFixed(2)}%
                                        </td>
                                        <td className="px-3 py-2.5 text-right">{fmtCap(r.marketCap)}</td>
                                        <td className="px-3 py-2.5 text-right">{r.peRatio != null ? r.peRatio.toFixed(1) : "—"}</td>
                                        <td className="px-3 py-2.5 text-right">{r.dividendYield != null ? `${r.dividendYield.toFixed(2)}%` : "—"}</td>
                                    </tr>
                                ))}
                                {filtered.length === 0 && (
                                    <tr><td colSpan={8} className="px-3 py-8 text-center text-sm text-muted-foreground">No stocks match these filters.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
                <p className="px-4 py-2.5 text-xs text-muted-foreground border-t border-border/60">
                    Curated universe · prices delayed ~15 min · Source: Finnhub
                </p>
            </CardContent>
        </Card>
    )
}
