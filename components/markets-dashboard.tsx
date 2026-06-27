"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { usePlaidLink } from "react-plaid-link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
    PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
    LineChart, Line, XAxis, YAxis,
} from "recharts"
import { Wallet, RefreshCw, PlusCircle, ShieldCheck, AlertCircle, TrendingUp } from "lucide-react"
import type { PortfolioResponse } from "@/app/api/plaid/holdings/route"
import MarketNews from "@/components/dashboard-market-news"
import Watchlist from "@/components/dashboard-watchlist"

const COLORS = ["#2563eb", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#84cc16"]
const TREND_KEY = "finnacalc.portfolioTrend"

function money(n: number, currency = "USD", max = 0) {
    return n.toLocaleString("en-US", { style: "currency", currency, maximumFractionDigits: max, minimumFractionDigits: max })
}
function money2(n: number, currency = "USD") {
    return n.toLocaleString("en-US", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function changeClass(n: number) {
    return n > 0 ? "text-emerald-600 dark:text-emerald-400" : n < 0 ? "text-red-500 dark:text-red-400" : "text-muted-foreground"
}

// Portfolio value trend — daily snapshots persisted in localStorage.
function recordTrend(value: number): { date: string; value: number }[] {
    if (typeof window === "undefined") return []
    let arr: { date: string; value: number }[] = []
    try {
        arr = JSON.parse(localStorage.getItem(TREND_KEY) || "[]")
    } catch {
        arr = []
    }
    const today = new Date().toISOString().split("T")[0]
    const existing = arr.find((p) => p.date === today)
    if (existing) existing.value = value
    else arr.push({ date: today, value })
    arr = arr.slice(-90)
    try {
        localStorage.setItem(TREND_KEY, JSON.stringify(arr))
    } catch {
        /* ignore */
    }
    return arr
}

export default function MarketsDashboard() {
    const [linkToken, setLinkToken] = useState<string | null>(null)
    const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null)
    const [status, setStatus] = useState<"idle" | "linking" | "loading" | "ready" | "error">("idle")
    const [error, setError] = useState<string | null>(null)
    const [trend, setTrend] = useState<{ date: string; value: number }[]>([])

    const initLink = useCallback(async () => {
        setError(null)
        setStatus("linking")
        try {
            const res = await fetch("/api/plaid/create-link-token", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ product: "investments" }),
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || "Could not start the connection.")
            setLinkToken(json.link_token)
        } catch (e: any) {
            setError(e?.message ?? "Could not start the connection.")
            setStatus("error")
        }
    }, [])

    const onPlaidSuccess = useCallback(async (publicToken: string) => {
        setStatus("loading")
        setError(null)
        try {
            const res = await fetch("/api/plaid/holdings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ public_token: publicToken }),
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || "Could not load your holdings.")
            if (!json.holdings?.length) throw new Error("No investment holdings were found on this account.")
            setPortfolio(json)
            setTrend(recordTrend(json.totalValue))
            setStatus("ready")
        } catch (e: any) {
            setError(e?.message ?? "Could not load your holdings.")
            setStatus("error")
        }
    }, [])

    const { open, ready } = usePlaidLink({
        token: linkToken,
        onSuccess: (public_token) => onPlaidSuccess(public_token),
        onExit: () => { if (status === "linking") setStatus("idle") },
    })

    useEffect(() => {
        if (linkToken && ready && status === "linking") open()
    }, [linkToken, ready, status, open])

    const disconnect = () => {
        setPortfolio(null)
        setLinkToken(null)
        setStatus("idle")
        setError(null)
    }

    const allocationData = useMemo(
        () => (portfolio ? portfolio.allocation.map((a) => ({ name: a.type, value: a.value })) : []),
        [portfolio]
    )
    const currency = portfolio?.currency ?? "USD"

    return (
        <div className="space-y-6">
            {/* ════════════════ PORTFOLIO ════════════════ */}
            {status === "ready" && portfolio ? (
                <>
                    <div className="grid grid-cols-3 gap-6">
                        <Card className="col-span-2 overflow-hidden">
                            <CardHeader className="pb-3 border-b border-border">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                                            <Wallet className="h-4 w-4 text-white" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-lg leading-tight">Total Portfolio Value</CardTitle>
                                            <p className="text-xs text-muted-foreground">Live portfolio · Plaid</p>
                                        </div>
                                    </div>
                                    <Button variant="outline" size="sm" className="h-8" onClick={disconnect}>
                                        <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Disconnect
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-5">
                                <p className="text-3xl font-bold">{money2(portfolio.totalValue, currency)}</p>
                                {portfolio.totalReturnPct != null && (
                                    <p className={`text-sm font-semibold ${changeClass(portfolio.totalReturn)}`}>
                                        {portfolio.totalReturn >= 0 ? "+" : ""}{money2(portfolio.totalReturn, currency)} ({portfolio.totalReturnPct.toFixed(2)}%) total return
                                    </p>
                                )}
                                <div className="grid grid-cols-3 gap-3 mt-4">
                                    <div className="rounded-lg border border-border p-3">
                                        <p className="text-xs text-muted-foreground">Cost basis</p>
                                        <p className="font-bold">{money(portfolio.totalCostBasis, currency)}</p>
                                    </div>
                                    <div className="rounded-lg border border-border p-3">
                                        <p className="text-xs text-muted-foreground">Holdings</p>
                                        <p className="font-bold">{portfolio.holdings.length}</p>
                                    </div>
                                    <div className="rounded-lg border border-border p-3">
                                        <p className="text-xs text-muted-foreground">Accounts</p>
                                        <p className="font-bold">{portfolio.accountCount}</p>
                                    </div>
                                </div>

                                <div className="mt-5">
                                    <p className="text-xs text-muted-foreground mb-2">Portfolio value trend</p>
                                    {trend.length >= 2 ? (
                                        <div className="h-40">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={trend}>
                                                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })} />
                                                    <YAxis hide domain={["auto", "auto"]} />
                                                    <Tooltip formatter={(v: number) => money2(v, currency)} contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))", fontSize: 12 }} />
                                                    <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2.5} dot={false} />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>
                                    ) : (
                                        <div className="h-40 rounded-lg border border-dashed border-border flex items-center justify-center text-center px-6">
                                            <p className="text-xs text-muted-foreground">Your value trend builds as you check in over time. Come back tomorrow to see it grow.</p>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="overflow-hidden">
                            <CardHeader className="pb-3 border-b border-border">
                                <CardTitle className="text-lg">Asset Allocation</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-5">
                                <div className="h-40">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={allocationData} cx="50%" cy="50%" innerRadius={42} outerRadius={70} paddingAngle={2} dataKey="value" nameKey="name" stroke="none">
                                                {allocationData.map((e, i) => <Cell key={e.name} fill={COLORS[i % COLORS.length]} />)}
                                            </Pie>
                                            <Tooltip formatter={(v: number) => `${money2(v, currency)} (${((v / portfolio.totalValue) * 100).toFixed(1)}%)`} contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))", fontSize: 12 }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="mt-3 space-y-1.5">
                                    {portfolio.allocation.map((a, i) => (
                                        <div key={a.type} className="flex items-center justify-between text-sm">
                                            <span className="flex items-center gap-2 min-w-0">
                                                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                                                <span className="truncate">{a.type}</span>
                                            </span>
                                            <span className="text-muted-foreground">{((a.value / portfolio.totalValue) * 100).toFixed(0)}%</span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="overflow-hidden">
                        <CardHeader className="pb-3 border-b border-border">
                            <CardTitle className="text-lg">My Holdings</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="text-xs text-muted-foreground border-b border-border bg-muted/30">
                                        <tr>
                                            <th className="px-4 py-2 text-left font-semibold">#</th>
                                            <th className="px-4 py-2 text-left font-semibold">Ticker</th>
                                            <th className="px-4 py-2 text-right font-semibold">Shares</th>
                                            <th className="px-4 py-2 text-right font-semibold">Avg cost</th>
                                            <th className="px-4 py-2 text-right font-semibold">Price</th>
                                            <th className="px-4 py-2 text-right font-semibold">Market value</th>
                                            <th className="px-4 py-2 text-right font-semibold">Total return</th>
                                            <th className="px-4 py-2 text-right font-semibold">Weight</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/60">
                                        {portfolio.holdings.map((h, i) => (
                                            <tr key={h.securityId || h.name} className="hover:bg-muted/40 transition-colors">
                                                <td className="px-4 py-2.5 text-muted-foreground">{i + 1}</td>
                                                <td className="px-4 py-2.5">
                                                    <p className="font-bold">{h.name}</p>
                                                    <p className="text-xs text-muted-foreground truncate max-w-[200px]">{h.fullName}</p>
                                                </td>
                                                <td className="px-4 py-2.5 text-right">{h.quantity.toLocaleString()}</td>
                                                <td className="px-4 py-2.5 text-right">{money2(h.avgCost, currency)}</td>
                                                <td className="px-4 py-2.5 text-right">{money2(h.price, currency)}</td>
                                                <td className="px-4 py-2.5 text-right font-medium">{money2(h.value, currency)}</td>
                                                <td className={`px-4 py-2.5 text-right font-semibold ${changeClass(h.totalReturn)}`}>
                                                    {h.totalReturn >= 0 ? "+" : ""}{money2(h.totalReturn, currency)}
                                                    {h.totalReturnPct != null && <span className="block text-xs font-normal">{h.totalReturnPct.toFixed(1)}%</span>}
                                                </td>
                                                <td className="px-4 py-2.5 text-right">{h.weight.toFixed(1)}%</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="border-t border-border bg-muted/30">
                                        <tr className="font-semibold">
                                            <td className="px-4 py-2.5" colSpan={5}>Total</td>
                                            <td className="px-4 py-2.5 text-right">{money2(portfolio.totalValue, currency)}</td>
                                            <td className={`px-4 py-2.5 text-right ${changeClass(portfolio.totalReturn)}`}>{portfolio.totalReturn >= 0 ? "+" : ""}{money2(portfolio.totalReturn, currency)}</td>
                                            <td className="px-4 py-2.5 text-right">100%</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </>
            ) : (
                <Card>
                    <CardContent className="py-10">
                        <div className="flex flex-col items-center justify-center text-center">
                            <div className="w-14 h-14 rounded-full bg-blue-50 dark:bg-blue-950 flex items-center justify-center mb-4">
                                <TrendingUp className="h-7 w-7 text-blue-600" />
                            </div>
                            <h3 className="font-semibold mb-1">Connect your portfolio</h3>
                            <p className="text-sm text-muted-foreground mb-5 max-w-md">
                                Securely link your brokerage to see total value, asset allocation, holdings, and returns. The market news below works without connecting.
                            </p>
                            {error && (
                                <div className="w-full max-w-md mb-4 flex items-start gap-2 text-left text-xs text-red-600 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                                    <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                                    <span>{error}</span>
                                </div>
                            )}
                            {status === "loading" ? (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <RefreshCw className="h-4 w-4 animate-spin" /> Importing holdings…
                                </div>
                            ) : (
                                <Button onClick={initLink} disabled={status === "linking"} className="bg-blue-600 hover:bg-blue-700">
                                    {status === "linking" ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Opening…</> : <><PlusCircle className="h-4 w-4 mr-2" />Connect brokerage</>}
                                </Button>
                            )}
                            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-3">
                                <ShieldCheck className="h-3.5 w-3.5" /> Bank-level encryption · we never see your login
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ════════════════ MARKET NEWS ════════════════ */}
            <MarketNews />

            {/* ════════════════ WATCHLIST ════════════════ */}
            <Watchlist />
        </div>
    )
}
