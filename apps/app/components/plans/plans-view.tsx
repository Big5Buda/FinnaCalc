"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import * as Icons from "lucide-react"
import { Check, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { ApiError, apiGet, apiPost } from "@/lib/api-client"
import { useAuth } from "@/components/providers/auth-provider"
import { PageBar, PageBody, SegmentedControl } from "@/components/shell/surface"
import { Badge, IconChip, Notice } from "@/components/ui/primitives"
import {
    PLANS,
    annualSavingsPercent,
    ctaTitle,
    maxAnnualSavingsPercent,
    priceFor,
    priceString,
    type BillingInterval,
    type Plan,
    type PlanTier,
} from "@/lib/plans"

/**
 * The upgrade screen — Budgeting Plus / Investing Plus / Pro, ported from
 * Features/Plans/PlansView.swift. On the web, billing is Stripe Checkout:
 * "Start …" creates a session through /api/billing/checkout and hands the
 * browser to Stripe; the entitlement is only ever written by the webhook, so
 * nothing is granted client-side.
 *
 * The Pro card keeps the app's inverted-spotlight treatment (fill = the page's
 * foreground, text = its background).
 */

type Entitlement = {
    tier: PlanTier | null
    interval: BillingInterval | null
    active: boolean
}

export function PlansView() {
    const { user, loading } = useAuth()
    const [interval, setInterval] = useState<BillingInterval>("annual")
    const [entitlement, setEntitlement] = useState<Entitlement | null>(null)
    const [workingTier, setWorkingTier] = useState<PlanTier | null>(null)
    const [error, setError] = useState<string | null>(null)

    const refresh = useCallback(async () => {
        if (!user) {
            setEntitlement(null)
            return
        }
        try {
            setEntitlement(await apiGet<Entitlement>("/api/billing/entitlement"))
        } catch (err) {
            // 503 means billing isn't configured yet — show the free state
            // quietly rather than an error the visitor can do nothing about.
            if (!(err instanceof ApiError && (err.notConfigured || err.status === 401))) {
                setError(err instanceof Error ? err.message : "Couldn't load your plan.")
            }
            setEntitlement(null)
        }
    }, [user])

    useEffect(() => {
        void refresh()
    }, [refresh])

    const currentTier = entitlement?.active ? entitlement.tier : null

    async function startCheckout(plan: Plan) {
        if (workingTier) return
        setError(null)
        setWorkingTier(plan.tier)
        try {
            const { url } = await apiPost<{ url: string }>("/api/billing/checkout", {
                tier: plan.tier,
                interval,
                platform: "web",
            })
            window.location.href = url
        } catch (err) {
            setError(err instanceof Error ? err.message : "Couldn't start checkout. Please try again.")
            setWorkingTier(null)
        }
    }

    async function openPortal() {
        setError(null)
        try {
            const { url } = await apiPost<{ url: string }>("/api/billing/portal")
            window.location.href = url
        } catch (err) {
            setError(err instanceof Error ? err.message : "Couldn't open your billing settings.")
        }
    }

    return (
        <>
            <PageBar title="Plans" />
            <PageBody className="flex w-full max-w-5xl flex-col gap-6">
                <div className="contents">

            <SegmentedControl
                label="Billing interval"
                className="w-full max-w-sm [&>button]:flex-1"
                value={interval}
                onChange={setInterval}
                options={(["monthly", "annual"] as BillingInterval[]).map((option) => ({
                    value: option,
                    label: (
                        <span className="flex items-center justify-center gap-1.5">
                            {option === "monthly" ? "Monthly" : "Annual"}
                            {option === "annual" && (
                                <span className="text-[10.5px] font-semibold text-positive">
                                    Save up to {maxAnnualSavingsPercent()}%
                                </span>
                            )}
                        </span>
                    ),
                }))}
            />

            {PLANS.map((plan) => (
                <PlanCard
                    key={plan.tier}
                    plan={plan}
                    interval={interval}
                    currentTier={currentTier}
                    working={workingTier === plan.tier}
                    disabled={workingTier !== null}
                    signedIn={Boolean(user)}
                    authLoading={loading}
                    onStart={() => startCheckout(plan)}
                />
            ))}

            {error && <Notice tone="error">{error}</Notice>}

            {currentTier && (
                <button
                    type="button"
                    onClick={openPortal}
                    className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3.5 text-sm font-semibold text-foreground transition hover:border-border-strong"
                >
                    Manage subscription
                    <span className="text-border-strong">›</span>
                </button>
            )}

            <footer className="flex flex-col gap-2 pt-1 text-center">
                <p className="text-[11.5px] text-muted-foreground">
                    Subscriptions auto-renew until you cancel. Where you bought the plan is where you manage
                    it: in-app purchases through your device settings, or here on finnacalc.com if you
                    subscribed on the web.
                </p>
                <p className="text-[10.5px] text-muted-foreground/85">
                    Budgeting Plus and FinnaCalc Pro include 2 connected bank logins per account. Each extra
                    login is $2 a month. Ad-free covers the pages the plan includes; FinnaCalc Pro covers the
                    whole app.
                </p>
                <div className="flex justify-center gap-4">
                    <Link href="/terms" className="text-[11.5px] font-semibold text-primary">
                        Terms
                    </Link>
                    <Link href="/privacy" className="text-[11.5px] font-semibold text-primary">
                        Privacy
                    </Link>
                </div>
            </footer>
                </div>
            </PageBody>
        </>
    )
}

function PlanCard({
    plan,
    interval,
    currentTier,
    working,
    disabled,
    signedIn,
    authLoading,
    onStart,
}: {
    plan: Plan
    interval: BillingInterval
    currentTier: PlanTier | null
    working: boolean
    disabled: boolean
    signedIn: boolean
    authLoading: boolean
    onStart: () => void
}) {
    const Icon = (Icons as unknown as Record<string, Icons.LucideIcon>)[plan.icon] ?? Icons.Sparkles
    const spotlight = plan.recommended
    const isCurrent = currentTier === plan.tier

    return (
        <section
            className={cn(
                "flex flex-col gap-3.5 rounded-2xl p-[18px]",
                spotlight
                    ? "bg-foreground text-background shadow-lg"
                    : "border border-border bg-card text-foreground"
            )}
        >
            <div className="flex items-center gap-2.5">
                {spotlight ? (
                    <Icon className="h-4 w-4 text-caution" strokeWidth={2.4} />
                ) : (
                    <IconChip>
                        <Icon className="h-4 w-4" strokeWidth={2.2} />
                    </IconChip>
                )}
                <div className="flex flex-1 flex-col">
                    <p className={cn("font-bold", spotlight ? "text-[17px]" : "text-[15.5px]")}>{plan.name}</p>
                    {!spotlight && <p className="text-xs text-muted-foreground">{plan.tagline}</p>}
                </div>
                {spotlight && <Badge>Best value</Badge>}
            </div>

            <div className="flex items-baseline gap-1.5">
                <span className="figure text-3xl font-bold">{priceString(priceFor(plan, interval))}</span>
                <span className={cn("text-sm", spotlight ? "opacity-65" : "text-muted-foreground")}>
                    {interval === "monthly" ? "/month" : "/year"}
                </span>
                {interval === "annual" && (
                    <span className="ml-1 rounded-full bg-positive/14 px-2 py-0.5 text-[11px] font-bold text-positive">
                        Save {annualSavingsPercent(plan)}%
                    </span>
                )}
            </div>

            <ul className="flex flex-col gap-2.5">
                {plan.benefits.map((benefit) => (
                    <li key={benefit.text} className="flex items-start gap-2.5 text-[13px]">
                        <Check
                            className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", spotlight ? "text-caution" : "text-positive")}
                            strokeWidth={3}
                        />
                        <span className={spotlight ? "opacity-95" : "text-body"}>{benefit.text}</span>
                    </li>
                ))}
            </ul>

            {isCurrent ? (
                <div>
                    <Badge variant="positive" dot>
                        Current plan
                    </Badge>
                </div>
            ) : currentTier ? null : signedIn ? (
                <button
                    type="button"
                    onClick={onStart}
                    disabled={disabled || authLoading}
                    className={cn(
                        "inline-flex items-center justify-center gap-2 rounded-full py-3 text-sm font-bold transition disabled:opacity-50",
                        spotlight ? "bg-primary text-white" : "bg-secondary text-foreground"
                    )}
                >
                    {working && <Loader2 className="h-4 w-4 animate-spin" />}
                    {ctaTitle(plan.tier)}
                </button>
            ) : (
                <Link
                    href="/sign-in?next=/plans"
                    className={cn(
                        "inline-flex items-center justify-center rounded-full py-3 text-sm font-bold transition",
                        spotlight ? "bg-primary text-white" : "bg-secondary text-foreground"
                    )}
                >
                    Sign in to subscribe
                </Link>
            )}
        </section>
    )
}
