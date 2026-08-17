"use client"

import Link from "next/link"
import { useMemo } from "react"
import * as Icons from "lucide-react"
import { currency, int } from "@/lib/format"
import { useBudget } from "@/components/providers/budget-provider"
import { categoryStyle } from "@/lib/budget/category-style"
import { detectSubscriptions } from "@/lib/budget/subscriptions"
import { cadenceTitle, isSubscription, monthlyAmount, type BudgetItem } from "@/lib/budget/types"
import { Notice, SectionLabel } from "@/components/ui/primitives"
import { PageBar, PageBody } from "@/components/shell/surface"

/**
 * Subscriptions — recurring charges found in imported transactions, plus the
 * lines the user tagged as subscriptions by hand. Ported from
 * Features/Budgeting/SubscriptionsView.swift.
 *
 * This is detection, not cancellation. Charge reminders are device
 * notifications in the app; the web shows the schedule but can't schedule one.
 */
export default function SubscriptionsPage() {
    const budget = useBudget()

    const detected = useMemo(() => detectSubscriptions(budget.currentHistory), [budget.currentHistory])
    const tagged = useMemo(
        () => budget.currentItems.filter((item) => isSubscription(item)),
        [budget.currentItems]
    )

    const monthlyTotal =
        detected.reduce((sum, sub) => sum + sub.averageAmount, 0) +
        tagged.reduce((sum, item) => sum + monthlyAmount(item), 0)

    return (
        <>
            <PageBar
                title={
                    <span className="flex items-center gap-2">
                        <Link href="/budgeting" className="text-muted-foreground hover:text-foreground">
                            Budgeting
                        </Link>
                        <span className="text-border-strong">/</span>
                        Subscriptions
                    </span>
                }
            />
            <PageBody className="flex w-full max-w-3xl flex-col gap-5">
                <p className="text-sm text-muted-foreground">
                    {detected.length + tagged.length > 0
                        ? `${detected.length + tagged.length} recurring · about $${int(monthlyTotal)} a month`
                        : "Recurring charges we can find in your transactions."}
                </p>

            {tagged.length > 0 && (
                <section className="flex flex-col gap-2.5">
                    <SectionLabel>Tagged in your budget</SectionLabel>
                    {tagged.map((item) => (
                        <TaggedRow key={item.id} item={item} />
                    ))}
                </section>
            )}

            <section className="flex flex-col gap-2.5">
                <SectionLabel>Detected in transactions</SectionLabel>
                {detected.length === 0 ? (
                    <Notice tone="info">
                        Nothing detected yet. Import a bank statement or connect a bank from{" "}
                        <Link href="/budgeting/budget" className="font-semibold text-primary">
                            My Budget
                        </Link>
                        , and charges that repeat on a real billing cycle show up here.
                    </Notice>
                ) : (
                    detected.map((sub) => {
                        const style = categoryStyle(sub.category)
                        const Icon =
                            (Icons as unknown as Record<string, Icons.LucideIcon>)[style.icon] ??
                            Icons.RefreshCw
                        return (
                            <article
                                key={sub.id}
                                className="flex items-center gap-3 rounded-xl border border-border bg-card p-4"
                            >
                                <span
                                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
                                    style={{ backgroundColor: `${style.tint}22`, color: style.tint }}
                                >
                                    <Icon className="h-4 w-4" />
                                </span>
                                <span className="flex min-w-0 flex-1 flex-col">
                                    <span className="truncate text-sm font-semibold text-foreground">
                                        {sub.merchant}
                                    </span>
                                    <span className="text-[11px] text-muted-foreground">
                                        {cadenceTitle(sub.cadence)} · {sub.occurrences} charges · last{" "}
                                        {sub.lastDate.toLocaleDateString()}
                                    </span>
                                </span>
                                <span className="figure shrink-0 text-sm font-bold text-foreground">
                                    {currency(sub.averageAmount, 2)}
                                </span>
                            </article>
                        )
                    })
                )}
            </section>

            <p className="text-xs text-muted-foreground">
                A charge is flagged when at least two payments to the same merchant land a real billing cycle
                apart, within 25% of each other. Rent, utilities, loans and insurance are excluded — they
                repeat, but they aren&rsquo;t subscriptions you&rsquo;d cancel.
            </p>
            </PageBody>
        </>
    )
}

function TaggedRow({ item }: { item: BudgetItem }) {
    const style = categoryStyle(item.category)
    const Icon = (Icons as unknown as Record<string, Icons.LucideIcon>)[style.icon] ?? Icons.RefreshCw
    const schedule = item.chargeSchedule
    return (
        <article className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
            <span
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
                style={{ backgroundColor: `${style.tint}22`, color: style.tint }}
            >
                <Icon className="h-4 w-4" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-semibold text-foreground">
                    {item.subcategory || item.category}
                </span>
                <span className="text-[11px] text-muted-foreground">
                    {schedule ? cadenceTitle(schedule.cadence) : "Recurring"}
                    {schedule?.day ? ` · bills on day ${schedule.day}` : ""} · {item.category}
                </span>
            </span>
            <span className="figure shrink-0 text-sm font-bold text-foreground">
                {currency(monthlyAmount(item), 2)}
                <span className="text-[11px] font-normal text-muted-foreground">/mo</span>
            </span>
        </article>
    )
}
