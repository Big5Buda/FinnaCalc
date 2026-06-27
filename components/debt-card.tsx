"use client"

import { useCallback, useEffect, useState } from "react"
import { usePlaidLink } from "react-plaid-link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
    CreditCard, RefreshCw, PlusCircle, ShieldCheck, AlertCircle,
    GraduationCap, Home, Info,
} from "lucide-react"
import type { LiabilitiesResponse } from "@/app/api/plaid/liabilities/route"

function fmtMoney(n: number, currency = "USD") {
    return n.toLocaleString("en-US", { style: "currency", currency, maximumFractionDigits: 0 })
}
function fmtMoney2(n: number, currency = "USD") {
    return n.toLocaleString("en-US", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Credit-utilization health bands (standard FICO guidance: under 30% is healthy)
function utilizationBand(u: number | null) {
    if (u == null) return { label: "—", text: "text-muted-foreground", bar: "bg-muted-foreground" }
    if (u < 10) return { label: "Excellent", text: "text-emerald-600 dark:text-emerald-400", bar: "bg-emerald-500" }
    if (u < 30) return { label: "Good", text: "text-emerald-600 dark:text-emerald-400", bar: "bg-emerald-500" }
    if (u < 50) return { label: "Fair", text: "text-amber-600 dark:text-amber-400", bar: "bg-amber-500" }
    return { label: "High", text: "text-red-600 dark:text-red-400", bar: "bg-red-500" }
}

export default function DebtCard() {
    const [linkToken, setLinkToken] = useState<string | null>(null)
    const [data, setData] = useState<LiabilitiesResponse | null>(null)
    const [status, setStatus] = useState<"idle" | "linking" | "loading" | "ready" | "error">("idle")
    const [error, setError] = useState<string | null>(null)

    const initLink = useCallback(async () => {
        setError(null)
        setStatus("linking")
        try {
            const res = await fetch("/api/plaid/create-link-token", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ product: "liabilities" }),
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
            const res = await fetch("/api/plaid/liabilities", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ public_token: publicToken }),
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || "Could not load your debts.")
            if (!json.creditLines?.length && !json.otherDebts?.length) {
                throw new Error("No credit cards or loans were found on this account.")
            }
            setData(json)
            setStatus("ready")
        } catch (e: any) {
            setError(e?.message ?? "Could not load your debts.")
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

    useEffect(() => {
        if (linkToken && ready && status === "linking") open()
    }, [linkToken, ready, status, open])

    const reset = () => {
        setData(null)
        setLinkToken(null)
        setStatus("idle")
        setError(null)
    }

    const currency = data?.currency ?? "USD"
    const overall = data ? utilizationBand(data.overallUtilization) : utilizationBand(null)

    return (
        <Card>
            <CardHeader className="pb-3 border-b border-border">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                            <CreditCard className="h-4 w-4 text-white" />
                        </div>
                        <div>
                            <CardTitle className="text-lg leading-tight">Debt &amp; Credit Utilization</CardTitle>
                            <p className="text-xs text-muted-foreground">Powered by Plaid · soft, no credit inquiry</p>
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

            <CardContent className="pt-5">
                {/* ── Connected ── */}
                {status === "ready" && data ? (
                    <div className="space-y-6">
                        {/* Summary tiles */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="rounded-xl border border-border p-4">
                                <p className="text-xs text-muted-foreground">Total debt</p>
                                <p className="text-2xl font-bold">{fmtMoney(data.totalDebt, currency)}</p>
                            </div>
                            <div className="rounded-xl border border-border p-4">
                                <p className="text-xs text-muted-foreground">Min. payments / mo</p>
                                <p className="text-2xl font-bold">{fmtMoney(data.totalMinimumPayments, currency)}</p>
                            </div>
                            <div className="rounded-xl border border-border p-4">
                                <p className="text-xs text-muted-foreground">Overall utilization</p>
                                <p className={`text-2xl font-bold ${overall.text}`}>
                                    {data.overallUtilization != null ? `${data.overallUtilization.toFixed(1)}%` : "—"}
                                    <span className="text-sm font-medium ml-2">{overall.label}</span>
                                </p>
                            </div>
                        </div>

                        {/* Overall utilization bar */}
                        {data.overallUtilization != null && (
                            <div>
                                <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all ${overall.bar}`}
                                        style={{ width: `${Math.min(data.overallUtilization, 100)}%` }}
                                    />
                                </div>
                                <p className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2">
                                    <Info className="h-3.5 w-3.5" />
                                    Keeping utilization under 30% helps your credit score.
                                </p>
                            </div>
                        )}

                        {/* Credit cards */}
                        {data.creditLines.length > 0 && (
                            <div className="space-y-3">
                                <h4 className="text-sm font-semibold text-muted-foreground">Credit cards</h4>
                                {data.creditLines.map((c) => {
                                    const band = utilizationBand(c.utilization)
                                    return (
                                        <div key={c.accountId || c.name} className="rounded-xl border border-border p-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="min-w-0">
                                                    <p className="font-semibold truncate">
                                                        {c.name}
                                                        {c.mask && <span className="text-muted-foreground font-normal"> ····{c.mask}</span>}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {fmtMoney2(c.balance, currency)}
                                                        {c.limit != null && <> of {fmtMoney2(c.limit, currency)} limit</>}
                                                    </p>
                                                </div>
                                                <div className="text-right flex-shrink-0">
                                                    <p className={`font-bold ${band.text}`}>
                                                        {c.utilization != null ? `${c.utilization.toFixed(0)}%` : "—"}
                                                    </p>
                                                    <p className="text-[11px] text-muted-foreground">utilization</p>
                                                </div>
                                            </div>
                                            {c.utilization != null && (
                                                <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-3">
                                                    <div className={`h-full rounded-full ${band.bar}`} style={{ width: `${Math.min(c.utilization, 100)}%` }} />
                                                </div>
                                            )}
                                            <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                                                {c.apr != null && <span>APR: <span className="font-medium text-foreground">{c.apr.toFixed(2)}%</span></span>}
                                                {c.minimumPayment != null && <span>Min payment: <span className="font-medium text-foreground">{fmtMoney2(c.minimumPayment, currency)}</span></span>}
                                                {c.nextDueDate && <span>Due: <span className="font-medium text-foreground">{c.nextDueDate}</span></span>}
                                                {c.isOverdue && <span className="text-red-600 font-semibold">Overdue</span>}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}

                        {/* Other debts */}
                        {data.otherDebts.length > 0 && (
                            <div className="space-y-3">
                                <h4 className="text-sm font-semibold text-muted-foreground">Loans</h4>
                                {data.otherDebts.map((d) => (
                                    <div key={d.accountId || d.name} className="rounded-xl border border-border p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                                                {d.type === "student" ? <GraduationCap className="h-4 w-4" /> : <Home className="h-4 w-4" />}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-semibold truncate">{d.name}</p>
                                                <p className="text-xs text-muted-foreground capitalize">
                                                    {d.type} loan{d.apr != null ? ` · ${d.apr.toFixed(2)}% APR` : ""}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <p className="font-bold">{fmtMoney2(d.balance, currency)}</p>
                                            {d.minimumPayment != null && (
                                                <p className="text-xs text-muted-foreground">{fmtMoney2(d.minimumPayment, currency)}/mo</p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <p className="text-[11px] text-muted-foreground">
                            Balances are pulled from your linked accounts via Plaid. This is a soft connection and does not affect your credit score.
                        </p>
                    </div>
                ) : status === "loading" ? (
                    /* ── Loading ── */
                    <div className="flex flex-col items-center justify-center text-center py-12">
                        <RefreshCw className="h-8 w-8 text-blue-600 animate-spin mb-3" />
                        <p className="text-sm font-medium">Importing your accounts…</p>
                        <p className="text-xs text-muted-foreground mt-1">Crunching balances and limits</p>
                    </div>
                ) : (
                    /* ── Idle / connect prompt ── */
                    <div className="flex flex-col items-center justify-center text-center py-10">
                        <div className="w-14 h-14 rounded-full bg-blue-50 dark:bg-blue-950 flex items-center justify-center mb-4">
                            <CreditCard className="h-7 w-7 text-blue-600" />
                        </div>
                        <h3 className="font-semibold mb-1">See your debt &amp; utilization</h3>
                        <p className="text-sm text-muted-foreground mb-5 max-w-sm">
                            Securely link your cards and loans to see balances, APRs, minimum payments, and your credit
                            utilization — the second biggest factor in your credit score.
                        </p>

                        {error && (
                            <div className="w-full max-w-sm mb-4 flex items-start gap-2 text-left text-xs text-red-600 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                                <span>{error}</span>
                            </div>
                        )}

                        <Button onClick={initLink} disabled={status === "linking"} className="bg-blue-600 hover:bg-blue-700">
                            {status === "linking" ? (
                                <>
                                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                    Opening…
                                </>
                            ) : (
                                <>
                                    <PlusCircle className="h-4 w-4 mr-2" />
                                    Connect accounts
                                </>
                            )}
                        </Button>

                        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-3">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Bank-level encryption · soft connection, no credit inquiry
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
