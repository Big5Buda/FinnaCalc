"use client"

import Link from "next/link"
import { use, useCallback, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { calcValue, currency, fixed } from "@/lib/format"
import { ApiError } from "@/lib/api-client"
import {
    accounts as fetchAccounts,
    connections as fetchConnections,
    orderImpact,
    orderImpactNotional,
    placeOrder,
    quote as fetchQuote,
    tradingBlockedReason,
    type BrokerageAccount,
    type Connection,
    type Order,
    type OrderImpact,
} from "@/lib/investing/snaptrade"
import { useAuth } from "@/components/providers/auth-provider"
import { Button, Notice } from "@/components/ui/primitives"

/**
 * The order ticket, ported from OrderTicketView.swift.
 *
 * Two steps, never one: Review calls /trade/impact, which validates the order
 * with the brokerage and returns the terms plus a tradeId; Confirm calls
 * /trade/place with that tradeId, so what executes is exactly what was
 * reviewed. Nothing is bought or sold until Confirm.
 *
 * FinnaCalc never holds money or securities — the brokerage executes under its
 * own terms, and a view-only connection says so instead of failing at impact.
 */
export default function TradePage({ params }: { params: Promise<{ symbol: string }> }) {
    const { symbol: raw } = use(params)
    const symbol = raw.toUpperCase()
    const { user, loading: authLoading } = useAuth()

    const [accounts, setAccounts] = useState<BrokerageAccount[]>([])
    const [connections, setConnections] = useState<Connection[]>([])
    const [accountId, setAccountId] = useState<string>("")
    const [side, setSide] = useState<"BUY" | "SELL">("BUY")
    const [amountMode, setAmountMode] = useState<"shares" | "dollars">("shares")
    const [units, setUnits] = useState("1")
    const [dollars, setDollars] = useState("")
    const [orderType, setOrderType] = useState<"Market" | "Limit">("Market")
    const [limitPrice, setLimitPrice] = useState("")
    const [live, setLive] = useState<{ bid?: number; ask?: number; last?: number } | null>(null)

    const [impact, setImpact] = useState<OrderImpact | null>(null)
    const [placed, setPlaced] = useState<Order | null>(null)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let active = true
        fetchAccounts()
            .then((response) => {
                if (!active) return
                setAccounts(response.accounts)
                setAccountId((current) => current || response.accounts[0]?.id || "")
            })
            .catch(() => {})
        fetchConnections()
            .then((response) => active && setConnections(response.connections))
            .catch(() => {})
        return () => {
            active = false
        }
    }, [])

    const account = accounts.find((entry) => entry.id === accountId)
    const connection = connections.find((entry) => entry.id === account?.connectionId)
    const blocked = tradingBlockedReason(connection)

    const loadQuote = useCallback(async () => {
        if (!accountId) return
        try {
            setLive(await fetchQuote(accountId, symbol))
        } catch {
            // A brokerage that won't quote isn't an error worth a banner: the
            // review step still prices the order.
            setLive(null)
        }
    }, [accountId, symbol])

    useEffect(() => {
        void loadQuote()
    }, [loadQuote])

    async function review() {
        setBusy(true)
        setError(null)
        setImpact(null)
        try {
            const result =
                amountMode === "dollars"
                    ? await orderImpactNotional({
                          accountId,
                          symbol,
                          action: side,
                          notionalValue: calcValue(dollars),
                      })
                    : await orderImpact({
                          accountId,
                          symbol,
                          action: side,
                          orderType,
                          timeInForce: "Day",
                          units: calcValue(units),
                          price: orderType === "Limit" ? calcValue(limitPrice) : null,
                      })
            setImpact(result)
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Couldn't review that order.")
        }
        setBusy(false)
    }

    async function confirm() {
        if (!impact) return
        setBusy(true)
        setError(null)
        try {
            setPlaced(await placeOrder(impact.tradeId))
            setImpact(null)
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Couldn't place that order.")
        }
        setBusy(false)
    }

    if (!authLoading && !user) {
        return (
            <Shell symbol={symbol}>
                <Notice tone="info">
                    <Link
                        href={`/sign-in?next=/investing/trade/${symbol}`}
                        className="font-semibold text-primary"
                    >
                        Sign in
                    </Link>{" "}
                    to place orders. The trading routes verify your account, so a browser session alone
                    can&rsquo;t trade.
                </Notice>
            </Shell>
        )
    }

    if (accounts.length === 0) {
        return (
            <Shell symbol={symbol}>
                <Notice tone="info">
                    No connected brokerage.{" "}
                    <Link href="/investing/portfolio" className="font-semibold text-primary">
                        Connect one
                    </Link>{" "}
                    to trade — orders execute at your brokerage, not here.
                </Notice>
            </Shell>
        )
    }

    if (placed) {
        return (
            <Shell symbol={symbol}>
                <Notice tone="info">
                    Order sent to {account?.institution ?? "your brokerage"}: {placed.action} {placed.symbol},{" "}
                    {placed.totalQuantity ?? "—"} shares. Status {placed.status ?? "—"}. Your brokerage decides
                    when and at what price it fills.
                </Notice>
                <div className="flex gap-2">
                    <Link
                        href="/investing/portfolio"
                        className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
                    >
                        Back to portfolio
                    </Link>
                    <Button variant="ghost" onClick={() => setPlaced(null)}>
                        Place another
                    </Button>
                </div>
            </Shell>
        )
    }

    return (
        <Shell symbol={symbol}>
            {blocked && <Notice tone="caution">{blocked}</Notice>}
            {error && <Notice tone="error">{error}</Notice>}

            <section className="flex flex-col gap-4 rounded-card border-[1.5px] border-border bg-card p-5">
                <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
                    Account
                    <select
                        value={accountId}
                        onChange={(event) => setAccountId(event.target.value)}
                        className={FIELD}
                    >
                        {accounts.map((entry) => (
                            <option key={entry.id} value={entry.id}>
                                {entry.institution} · {entry.name}
                                {entry.cash !== null ? ` · ${currency(entry.cash, 2)} cash` : ""}
                            </option>
                        ))}
                    </select>
                </label>

                <div className="flex rounded-full bg-secondary p-[3px]">
                    {(["BUY", "SELL"] as const).map((option) => (
                        <button
                            key={option}
                            type="button"
                            onClick={() => {
                                setSide(option)
                                setImpact(null)
                            }}
                            className={cn(
                                "flex-1 rounded-full py-2 text-xs transition",
                                side === option
                                    ? "bg-card font-bold text-foreground shadow-sm"
                                    : "font-semibold text-muted-foreground"
                            )}
                        >
                            {option === "BUY" ? "Buy" : "Sell"}
                        </button>
                    ))}
                </div>

                <div className="flex rounded-full bg-secondary p-[3px]">
                    {(
                        [
                            { value: "shares", label: "Shares" },
                            { value: "dollars", label: "Dollars" },
                        ] as const
                    ).map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                                setAmountMode(option.value)
                                setImpact(null)
                            }}
                            className={cn(
                                "flex-1 rounded-full py-2 text-xs transition",
                                amountMode === option.value
                                    ? "bg-card font-bold text-foreground shadow-sm"
                                    : "font-semibold text-muted-foreground"
                            )}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>

                {amountMode === "shares" ? (
                    <div className="grid grid-cols-2 gap-3">
                        <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
                            Shares
                            <input
                                value={units}
                                onChange={(event) => {
                                    setUnits(event.target.value.replace(/[^0-9.]/g, ""))
                                    setImpact(null)
                                }}
                                inputMode="decimal"
                                className={cn(FIELD, "figure")}
                            />
                        </label>
                        <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
                            Order type
                            <select
                                value={orderType}
                                onChange={(event) => {
                                    setOrderType(event.target.value as "Market" | "Limit")
                                    setImpact(null)
                                }}
                                className={FIELD}
                            >
                                <option value="Market">Market</option>
                                <option value="Limit">Limit</option>
                            </select>
                        </label>
                        {orderType === "Limit" && (
                            <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
                                Limit price
                                <input
                                    value={limitPrice}
                                    onChange={(event) => {
                                        setLimitPrice(event.target.value.replace(/[^0-9.]/g, ""))
                                        setImpact(null)
                                    }}
                                    inputMode="decimal"
                                    className={cn(FIELD, "figure")}
                                />
                            </label>
                        )}
                    </div>
                ) : (
                    <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
                        Amount
                        <input
                            value={dollars}
                            onChange={(event) => {
                                setDollars(event.target.value.replace(/[^0-9.]/g, ""))
                                setImpact(null)
                            }}
                            inputMode="decimal"
                            placeholder="0"
                            className={cn(FIELD, "figure")}
                        />
                        <span className="text-xs font-normal text-muted-foreground">
                            Dollar orders are Market, Day, and need a brokerage that supports fractional
                            shares. Your brokerage works out the share count.
                        </span>
                    </label>
                )}

                {live && (
                    <p className="figure text-xs font-normal text-muted-foreground">
                        {live.last ? `Last ${currency(live.last, 2)}` : ""}
                        {live.bid ? ` · Bid ${currency(live.bid, 2)}` : ""}
                        {live.ask ? ` · Ask ${currency(live.ask, 2)}` : ""}
                    </p>
                )}

                <Button
                    onClick={() => void review()}
                    disabled={
                        busy ||
                        !accountId ||
                        (amountMode === "shares" ? !(calcValue(units) > 0) : !(calcValue(dollars) > 0))
                    }
                >
                    {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                    Review order
                </Button>
            </section>

            {impact && (
                <section className="flex flex-col gap-3 rounded-card border-[1.5px] border-primary bg-card p-5">
                    <h2 className="text-lg font-bold text-foreground">Review</h2>
                    <dl className="flex flex-col gap-1.5 text-sm">
                        <Row label="Order" value={`${impact.action ?? side} ${impact.symbol ?? symbol}`} />
                        {impact.units !== null && <Row label="Shares" value={fixed(impact.units, 4)} />}
                        {impact.notionalValue !== null && (
                            <Row label="Amount" value={currency(impact.notionalValue, 2)} />
                        )}
                        {impact.price !== null && <Row label="Price" value={currency(impact.price, 2)} />}
                        {impact.estimatedCommission !== null && (
                            <Row label="Commission" value={currency(impact.estimatedCommission, 2)} />
                        )}
                        {impact.remainingCash !== null && (
                            <Row label="Cash after" value={currency(impact.remainingCash, 2)} />
                        )}
                        {impact.exchange && <Row label="Routes to" value={impact.exchange} />}
                    </dl>
                    <p className="text-xs text-muted-foreground">
                        These are your brokerage&rsquo;s terms, not an estimate of ours. Confirming sends the
                        order; the fill price and timing are your brokerage&rsquo;s.
                    </p>
                    <div className="flex gap-2">
                        <Button onClick={() => void confirm()} disabled={busy}>
                            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                            Confirm {side === "BUY" ? "buy" : "sell"}
                        </Button>
                        <Button variant="ghost" onClick={() => setImpact(null)}>
                            Back
                        </Button>
                    </div>
                </section>
            )}
        </Shell>
    )
}

function Shell({ symbol, children }: { symbol: string; children: React.ReactNode }) {
    return (
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-5 py-6">
            <header className="flex flex-col gap-1">
                <Link href={`/investing/stocks/${symbol}`} className="text-sm font-semibold text-primary">
                    ← {symbol}
                </Link>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Trade {symbol}</h1>
                <p className="text-sm text-muted-foreground">
                    Orders are reviewed by you and executed by your brokerage. FinnaCalc never holds your money
                    or securities.
                </p>
            </header>
            {children}
        </div>
    )
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="figure font-semibold text-foreground">{value}</dd>
        </div>
    )
}

const FIELD =
    "h-10 rounded-md border border-input bg-background px-3 text-sm font-normal text-foreground outline-none transition focus:border-primary"
