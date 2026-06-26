"use client"

import { useCallback, useEffect, useState } from "react"
import { usePlaidLink } from "react-plaid-link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts"
import { Wallet, RefreshCw, PlusCircle, TrendingUp, ShieldCheck, AlertCircle } from "lucide-react"
import type { PortfolioResponse, PortfolioHolding } from "@/app/api/plaid/holdings/route"

// Distinct, colorblind-friendly palette reused for slices
const COLORS = [
    "#2563eb", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444",
    "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#6366f1",
    "#14b8a6", "#a855f7",
]

function fmtMoney(n: number, currency = "USD") {
    return n.toLocaleString("en-US", { style: "currency", currency, maximumFractionDigits: 0 })
}

function fmtMoneyPrecise(n: number, currency = "USD") {
    return n.toLocaleString("en-US", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

type ChartDatum = { name: string; fullName: string; value: number; type: string }

// Collapse the long tail into an "Other" slice so the chart stays readable
function toChartData(holdings: PortfolioHolding[]): ChartDatum[] {
    const TOP = 7
    if (holdings.length <= TOP) {
        return holdings.map((h) => ({ name: h.name, fullName: h.fullName, value: h.value, type: h.type }))
    }
    const top = holdings.slice(0, TOP).map((h) => ({ name: h.name, fullName: h.fullName, value: h.value, type: h.type }))
    const otherValue = holdings.slice(TOP).reduce((sum, h) => sum + h.value, 0)
    return [...top, { name: "Other", fullName: `${holdings.length - TOP} more holdings`, value: Math.round(otherValue * 100) / 100, type: "Mixed" }]
}

export default function PortfolioCard() {
    const [linkToken, setLinkToken] = useState<string | null>(null)
    const [data, setData] = useState<PortfolioResponse | null>(null)
    const [status, setStatus] = useState<"idle" | "linking" | "loading" | "ready" | "error">("idle")
    const [error, setError] = useState<string | null>(null)

    // Fetch a link token lazily the first time the user wants to connect
    const initLink = useCallback(async () => {
        setError(null)
        setStatus("linking")
        try {
            const res = await fetch("/api/plaid/create-link-token", { method: "POST" })
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
            if (!json.holdings?.length) {
                throw new Error("No investment holdings were found on this account.")
            }
            setData(json)
            setStatus("ready")
        } catch (e: any) {
            setError(e?.message ?? "Could not load your holdings.")
            setStatus("error")
        }
    }, [])

    const { open, ready } = usePlaidLink({
        token: linkToken,
        onSuccess: (public_token) => onPlaidSuccess(public_token),
        onExit: () => {
            if (status === "linking") setStatus("idle")
        },
    })

    // Open Plaid Link automatically once the token is ready and the widget is initialized
    useEffect(() => {
        if (linkToken && ready && status === "linking") open()
    }, [linkToken, ready, status, open])

    const reset = () => {
        setData(null)
        setLinkToken(null)
        setStatus("idle")
        setError(null)
    }

    const chartData = data ? toChartData(data.holdings) : []

    return (
        <Card className="flex flex-col h-full">
            <CardHeader className="pb-3 border-b border-border">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                            <Wallet className="h-4 w-4 text-white" />
                        </div>
                        <div>
                            <CardTitle className="text-lg leading-tight">Your Portfolio</CardTitle>
                            <p className="text-xs text-muted-foreground">Powered by Plaid</p>
                        </div>
                    </div>
                    {status === "ready" && (
                        <Button variant="outline" size="sm" onClick={reset} className="h-8">
                            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                            New
                        </Button>
                    )}
                </div>
            </CardHeader>

            <CardContent className="flex-1 flex flex-col pt-4">
                {/* ── Connected: show the pie chart + holdings ── */}
                {status === "ready" && data ? (
                    <div className="flex flex-col h-full">
                        <div className="text-center mb-2">
                            <p className="text-xs text-muted-foreground">Total value</p>
                            <p className="text-2xl font-bold">{fmtMoneyPrecise(data.totalValue, data.currency)}</p>
                            <p className="text-xs text-muted-foreground">
                                {data.holdings.length} holdings · {data.accountCount} account{data.accountCount !== 1 ? "s" : ""}
                            </p>
                        </div>

                        <div className="h-44">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={chartData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={42}
                                        outerRadius={72}
                                        paddingAngle={2}
                                        dataKey="value"
                                        nameKey="name"
                                        stroke="none"
                                    >
                                        {chartData.map((entry, i) => (
                                            <Cell key={entry.name} fill={COLORS[i % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={(value: number, _name, props: any) => [
                                            `${fmtMoneyPrecise(value, data.currency)} (${((value / data.totalValue) * 100).toFixed(1)}%)`,
                                            props?.payload?.fullName || props?.payload?.name,
                                        ]}
                                        contentStyle={{
                                            borderRadius: 8,
                                            border: "1px solid hsl(var(--border))",
                                            background: "hsl(var(--background))",
                                            fontSize: 12,
                                        }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Legend / holdings list */}
                        <div className="mt-3 space-y-1.5 overflow-y-auto flex-1 pr-1" style={{ maxHeight: 160 }}>
                            {chartData.map((entry, i) => (
                                <div key={entry.name} className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                                        <span className="font-medium truncate">{entry.name}</span>
                                        <span className="text-xs text-muted-foreground truncate hidden">{entry.type}</span>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <span className="text-xs text-muted-foreground">
                                            {((entry.value / data.totalValue) * 100).toFixed(1)}%
                                        </span>
                                        <span className="font-semibold tabular-nums">{fmtMoney(entry.value, data.currency)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Allocation by type */}
                        {data.allocation.length > 1 && (
                            <div className="mt-3 pt-3 border-t border-border/50">
                                <p className="text-xs font-medium text-muted-foreground mb-1.5">Asset mix</p>
                                <div className="flex h-2 rounded-full overflow-hidden">
                                    {data.allocation.map((a, i) => (
                                        <div
                                            key={a.type}
                                            title={`${a.type}: ${((a.value / data.totalValue) * 100).toFixed(1)}%`}
                                            style={{
                                                width: `${(a.value / data.totalValue) * 100}%`,
                                                background: COLORS[i % COLORS.length],
                                            }}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ) : status === "loading" ? (
                    /* ── Fetching holdings ── */
                    <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
                        <RefreshCw className="h-8 w-8 text-blue-600 animate-spin mb-3" />
                        <p className="text-sm font-medium">Importing your holdings…</p>
                        <p className="text-xs text-muted-foreground mt-1">Crunching your portfolio</p>
                    </div>
                ) : (
                    /* ── Idle / connect prompt ── */
                    <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
                        <div className="w-14 h-14 rounded-full bg-blue-50 dark:bg-blue-950 flex items-center justify-center mb-4">
                            <TrendingUp className="h-7 w-7 text-blue-600" />
                        </div>
                        <h3 className="font-semibold mb-1">See your real portfolio</h3>
                        <p className="text-sm text-muted-foreground mb-5 max-w-[15rem]">
                            Securely link your brokerage to visualize your holdings as a live pie chart.
                        </p>

                        {error && (
                            <div className="w-full mb-4 flex items-start gap-2 text-left text-xs text-red-600 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                                <span>{error}</span>
                            </div>
                        )}

                        <Button
                            onClick={initLink}
                            disabled={status === "linking"}
                            className="w-full bg-blue-600 hover:bg-blue-700"
                        >
                            {status === "linking" ? (
                                <>
                                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                    Opening…
                                </>
                            ) : (
                                <>
                                    <PlusCircle className="h-4 w-4 mr-2" />
                                    Connect brokerage
                                </>
                            )}
                        </Button>

                        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-3">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Bank-level encryption · We never see your login
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
