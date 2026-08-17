"use client"

import Link from "next/link"
import {
    ArrowUpRight,
    BookOpen,
    Calculator,
    FileText,
    LineChart,
    PiggyBank,
    Sparkles,
    Wallet,
} from "lucide-react"
import { currency, percent } from "@/lib/format"
import { CALCULATORS } from "@/lib/calculators/catalog"
import { useAuth } from "@/components/providers/auth-provider"
import { useBudget } from "@/components/providers/budget-provider"
import { useWatchlist } from "@/components/providers/watchlist-provider"
import { useChat } from "@/components/providers/chat-provider"
import {
    ActionPill,
    EmptyState,
    PageBar,
    PageBody,
    Panel,
    PanelTitle,
    Stat,
} from "@/components/shell/surface"

/**
 * Home: the workspace you land on after signing in.
 *
 * This replaced a marketing landing page, which stopped making sense once the
 * app went behind sign-in (#114) — everybody who reaches this route already
 * has an account, and marketing now lives on finnacalc.com.
 *
 * The rule this screen is built under: show the reader THEIR figures, or say
 * plainly that there aren't any yet. Every panel here has a real empty state
 * rather than a sample budget or a demo portfolio, because a plausible fake on
 * the first screen after signup is exactly the lie the house rules forbid.
 */
export default function HomePage() {
    const { user } = useAuth()
    const budget = useBudget()
    const watchlist = useWatchlist()
    const { openChat } = useChat()

    const firstName = user?.displayName?.split(" ")[0] ?? "there"
    const hasBudget = budget.ready && (budget.monthlyIncome > 0 || budget.monthlyExpenses > 0)

    return (
        <>
            <PageBar
                title={`Good day, ${firstName}`}
                actions={
                    <>
                        <ActionPill
                            tone="outline"
                            onClick={() => openChat()}
                            icon={<Sparkles className="h-4 w-4" aria-hidden="true" />}
                        >
                            Ask FinnaBot
                        </ActionPill>
                        <ActionPill href="/budgeting/budget">Open your budget</ActionPill>
                    </>
                }
            />

            <PageBody className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
                <div className="flex flex-col gap-5">
                    {/* ── This month ────────────────────────────────────── */}
                    <Panel>
                        <div className="flex flex-wrap items-center justify-between gap-3 pb-5">
                            <PanelTitle>This month</PanelTitle>
                            <Link
                                href="/budgeting/analysis"
                                className="inline-flex items-center gap-1 text-sm font-medium text-foreground hover:underline"
                            >
                                Analysis <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                            </Link>
                        </div>

                        {hasBudget ? (
                            <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
                                <Stat label="Income" value={currency(budget.monthlyIncome)} />
                                <Stat label="Expenses" value={currency(budget.monthlyExpenses)} />
                                <Stat
                                    label="Net"
                                    value={currency(budget.monthlyNet)}
                                    tone={budget.monthlyNet >= 0 ? "positive" : "negative"}
                                />
                                <Stat
                                    label="Savings rate"
                                    // null when there's no income or nothing routed
                                    // to savings — an em dash, never a zero.
                                    value={
                                        budget.savingsRate === null
                                            ? "—"
                                            : percent(budget.savingsRate, 0)
                                    }
                                    hint={budget.savingsRate === null ? "Nothing routed yet" : undefined}
                                />
                            </div>
                        ) : (
                            <EmptyState
                                icon={<Wallet className="h-5 w-5" aria-hidden="true" />}
                                title="No budget yet"
                                body="Add income and expenses — or link a bank through Plaid — and this fills with your real month."
                                action={<ActionPill href="/budgeting/budget">Start a budget</ActionPill>}
                            />
                        )}
                    </Panel>

                    {/* ── Where to go ───────────────────────────────────── */}
                    <div className="grid gap-4 sm:grid-cols-2">
                        <ShortcutCard
                            href="/calculators"
                            icon={<Calculator className="h-5 w-5" aria-hidden="true" />}
                            title="Calculators"
                            body={`${CALCULATORS.length} tools that show their work.`}
                        />
                        <ShortcutCard
                            href="/investing"
                            icon={<LineChart className="h-5 w-5" aria-hidden="true" />}
                            title="Investing"
                            body="Live prices, filings, and your own portfolio."
                        />
                        <ShortcutCard
                            href="/taxes"
                            icon={<FileText className="h-5 w-5" aria-hidden="true" />}
                            title="Taxes"
                            body="Estimate the bill before April does."
                        />
                        <ShortcutCard
                            href="/education"
                            icon={<BookOpen className="h-5 w-5" aria-hidden="true" />}
                            title="Learn"
                            body="Short lessons, plain language."
                        />
                    </div>
                </div>

                {/* ── Right column ──────────────────────────────────────── */}
                <div className="flex flex-col gap-5">
                    <Panel>
                        <div className="flex items-center justify-between gap-3 pb-4">
                            <PanelTitle>Watchlist</PanelTitle>
                            <Link
                                href="/investing/watchlist"
                                className="text-sm font-medium text-foreground hover:underline"
                            >
                                Open
                            </Link>
                        </div>

                        {watchlist.ready && watchlist.symbols.length > 0 ? (
                            <ul className="flex flex-wrap gap-2">
                                {watchlist.symbols.slice(0, 12).map((symbol) => (
                                    <li key={symbol}>
                                        <Link
                                            href={`/investing/stocks/${symbol}`}
                                            className="figure inline-flex rounded-pill bg-secondary px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-border"
                                        >
                                            {symbol}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <EmptyState
                                className="py-8"
                                icon={<LineChart className="h-5 w-5" aria-hidden="true" />}
                                title="Nothing on your watchlist"
                                body="Add a symbol and it shows up here."
                                action={
                                    <ActionPill tone="outline" href="/investing">
                                        Find a stock
                                    </ActionPill>
                                }
                            />
                        )}
                    </Panel>

                    <Panel>
                        <div className="flex items-center justify-between gap-3 pb-4">
                            <PanelTitle>Goals</PanelTitle>
                            <Link
                                href="/budgeting/goals"
                                className="text-sm font-medium text-foreground hover:underline"
                            >
                                Open
                            </Link>
                        </div>

                        {budget.ready && budget.currentGoals.length > 0 ? (
                            <ul className="flex flex-col gap-3">
                                {budget.currentGoals.slice(0, 4).map((goal) => {
                                    const share =
                                        goal.targetAmount > 0
                                            ? Math.min(100, (goal.currentAmount / goal.targetAmount) * 100)
                                            : 0
                                    return (
                                        <li key={goal.id} className="flex flex-col gap-1.5">
                                            <div className="flex items-baseline justify-between gap-3">
                                                <span className="truncate text-sm font-medium text-foreground">
                                                    {goal.name}
                                                </span>
                                                <span className="figure text-xs text-muted-foreground">
                                                    {currency(goal.currentAmount)} / {currency(goal.targetAmount)}
                                                </span>
                                            </div>
                                            <span className="h-1.5 overflow-hidden rounded-pill bg-secondary">
                                                <span
                                                    className="block h-full rounded-pill bg-positive"
                                                    style={{ width: `${share}%` }}
                                                />
                                            </span>
                                        </li>
                                    )
                                })}
                            </ul>
                        ) : (
                            <EmptyState
                                className="py-8"
                                icon={<PiggyBank className="h-5 w-5" aria-hidden="true" />}
                                title="No goals set"
                                body="Pick a number and a date; we'll do the arithmetic in between."
                                action={
                                    <ActionPill tone="outline" href="/budgeting/goals">
                                        Set a goal
                                    </ActionPill>
                                }
                            />
                        )}
                    </Panel>
                </div>
            </PageBody>
        </>
    )
}

function ShortcutCard({
    href,
    icon,
    title,
    body,
}: {
    href: string
    icon: React.ReactNode
    title: string
    body: string
}) {
    return (
        <Link
            href={href}
            className="flex flex-col gap-2 rounded-card border border-border bg-card p-5 transition-colors hover:border-border-strong"
        >
            <span className="text-foreground">{icon}</span>
            <span className="text-base font-semibold text-foreground">{title}</span>
            <span className="text-sm leading-relaxed text-muted-foreground">{body}</span>
        </Link>
    )
}
