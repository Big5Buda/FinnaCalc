"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Landmark, RefreshCw, PlusCircle, ShieldCheck, AlertCircle, LinkIcon, UserRound } from "lucide-react"
import { useAuth } from "@/lib/auth"
import { supabaseAuthHeader } from "@/lib/supabase"
import type { BrokerageAccount, BrokeragePosition } from "@/app/api/snaptrade/accounts/route"

interface AccountsResponse {
    configured: boolean
    connected?: boolean
    accounts: BrokerageAccount[]
    positions: BrokeragePosition[]
    totalValue?: number
    currency?: string
    error?: string
}

function money(n: number | null | undefined, currency = "USD") {
    if (n == null) return "—"
    return n.toLocaleString("en-US", { style: "currency", currency, maximumFractionDigits: 2 })
}

export default function BrokerageConnect() {
    const { user, loading: authLoading } = useAuth()
    const [data, setData] = useState<AccountsResponse | null>(null)
    const [loading, setLoading] = useState(true)
    const [connecting, setConnecting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Brokerage routes verify the signed-in user (SnapTrade credentials are
    // stored server-side keyed to the account), so every call sends the token.
    const load = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch("/api/snaptrade/accounts", {
                headers: await supabaseAuthHeader(),
            })
            const json = await res.json()
            setData(json)
            if (json.error) setError(json.error)
        } catch {
            setData({ configured: true, accounts: [], positions: [] })
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        if (user) load()
    }, [load, user])

    const connect = async () => {
        setError(null)
        setConnecting(true)
        try {
            const res = await fetch("/api/snaptrade/connect", {
                method: "POST",
                headers: await supabaseAuthHeader(),
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || "Could not start the connection.")
            if (!json.redirectURI) throw new Error("No connection link returned.")
            // Send the user to SnapTrade's connection portal; they return to /investing.
            window.location.href = json.redirectURI
        } catch (e: any) {
            setError(e?.message ?? "Could not start the connection.")
            setConnecting(false)
        }
    }

    const disconnect = async () => {
        await fetch("/api/snaptrade/disconnect", {
            method: "POST",
            headers: await supabaseAuthHeader(),
        }).catch(() => {})
        setData((d) => (d ? { ...d, connected: false, accounts: [], positions: [] } : d))
    }

    const configured = data?.configured ?? true
    const accounts = data?.accounts ?? []
    const positions = data?.positions ?? []
    const currency = data?.currency ?? "USD"
    const hasAccounts = accounts.length > 0

    return (
        <Card className="overflow-hidden">
            <CardHeader className="pb-3 border-b border-border">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                            <Landmark className="h-4 w-4 text-white" />
                        </div>
                        <div>
                            <CardTitle className="text-lg leading-tight">Your Brokerage</CardTitle>
                            <p className="text-xs text-muted-foreground">Connect any broker to view &amp; trade · Powered by SnapTrade</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {hasAccounts && (
                            <>
                                <Button variant="outline" size="sm" className="h-8" onClick={load} disabled={loading}>
                                    <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
                                    Refresh
                                </Button>
                                <Button variant="outline" size="sm" className="h-8" onClick={disconnect}>
                                    Disconnect
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            </CardHeader>

            <CardContent className="pt-5">
                {!user && !authLoading ? (
                    /* Signed out — brokerage links are tied to your FinnaCalc account */
                    <div className="flex flex-col items-center justify-center text-center py-8">
                        <div className="w-14 h-14 rounded-full bg-blue-50 dark:bg-blue-950 flex items-center justify-center mb-4">
                            <UserRound className="h-7 w-7 text-blue-600" />
                        </div>
                        <h3 className="font-semibold mb-1">Sign in to connect your brokerage</h3>
                        <p className="text-sm text-muted-foreground mb-5 max-w-md">
                            Your brokerage link is tied to your FinnaCalc account, so it follows you across devices and signing
                            out ends access.
                        </p>
                        <Button asChild className="bg-blue-600 hover:bg-blue-700">
                            <Link href="/sign-in">Sign in</Link>
                        </Button>
                    </div>
                ) : loading || authLoading ? (
                    <div className="space-y-2">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
                        ))}
                    </div>
                ) : !configured ? (
                    <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/50 border border-border rounded-lg px-4 py-3">
                        <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        <span>
                            Brokerage connections aren&apos;t configured yet. Add <code className="text-xs">SNAPTRADE_CLIENT_ID</code> and{" "}
                            <code className="text-xs">SNAPTRADE_CONSUMER_KEY</code> to enable connecting a broker.
                        </span>
                    </div>
                ) : hasAccounts ? (
                    <div className="space-y-5">
                        {/* Accounts */}
                        <div className="grid grid-cols-3 gap-4">
                            {accounts.map((a) => (
                                <div key={a.id} className="rounded-xl border border-border p-4">
                                    <p className="text-xs text-muted-foreground truncate">{a.institution}</p>
                                    <p className="font-semibold truncate">
                                        {a.name}
                                        {a.number ? <span className="text-muted-foreground font-normal"> ····{a.number.slice(-4)}</span> : null}
                                    </p>
                                    <p className="text-lg font-bold mt-1">{money(a.totalValue, a.currency)}</p>
                                </div>
                            ))}
                        </div>

                        {/* Positions */}
                        {positions.length > 0 && (
                            <div className="rounded-xl border border-border overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="text-xs text-muted-foreground border-b border-border bg-muted/30">
                                            <tr>
                                                <th className="px-4 py-2 text-left font-semibold">Symbol</th>
                                                <th className="px-4 py-2 text-right font-semibold">Units</th>
                                                <th className="px-4 py-2 text-right font-semibold">Price</th>
                                                <th className="px-4 py-2 text-right font-semibold">Market value</th>
                                                <th className="px-4 py-2 text-right font-semibold">Open P/L</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/60">
                                            {positions.map((p, i) => (
                                                <tr key={`${p.symbol}-${i}`} className="hover:bg-muted/40">
                                                    <td className="px-4 py-2.5">
                                                        <p className="font-bold">{p.symbol}</p>
                                                        {p.description && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{p.description}</p>}
                                                    </td>
                                                    <td className="px-4 py-2.5 text-right">{p.units}</td>
                                                    <td className="px-4 py-2.5 text-right">{money(p.price, currency)}</td>
                                                    <td className="px-4 py-2.5 text-right font-medium">{money(p.marketValue, currency)}</td>
                                                    <td className={`px-4 py-2.5 text-right font-semibold ${p.openPnl == null ? "" : p.openPnl >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                                                        {p.openPnl == null ? "—" : `${p.openPnl >= 0 ? "+" : ""}${money(p.openPnl, currency)}`}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        <div className="flex items-center justify-between">
                            <Button variant="outline" size="sm" onClick={connect} disabled={connecting}>
                                <PlusCircle className="h-4 w-4 mr-2" />
                                {connecting ? "Opening…" : "Connect another broker"}
                            </Button>
                            <span className="text-xs text-muted-foreground">Trading from FinnaCalc is coming next.</span>
                        </div>
                    </div>
                ) : (
                    /* Not connected yet */
                    <div className="flex flex-col items-center justify-center text-center py-8">
                        <div className="w-14 h-14 rounded-full bg-blue-50 dark:bg-blue-950 flex items-center justify-center mb-4">
                            <LinkIcon className="h-7 w-7 text-blue-600" />
                        </div>
                        <h3 className="font-semibold mb-1">Connect the broker you already use</h3>
                        <p className="text-sm text-muted-foreground mb-5 max-w-md">
                            Link Robinhood, Webull, Schwab, Fidelity and more to see your real positions in FinnaCalc — and trade from here as we roll it out.
                        </p>

                        {error && (
                            <div className="w-full max-w-md mb-4 flex items-start gap-2 text-left text-xs text-red-600 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                                <span>{error}</span>
                            </div>
                        )}

                        <Button onClick={connect} disabled={connecting} className="bg-blue-600 hover:bg-blue-700">
                            {connecting ? (
                                <>
                                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                    Opening…
                                </>
                            ) : (
                                <>
                                    <PlusCircle className="h-4 w-4 mr-2" />
                                    Connect a brokerage
                                </>
                            )}
                        </Button>

                        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-3">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Secure connection via SnapTrade · we never see your brokerage password
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
