import Link from "next/link"
import {
    BookOpen,
    Calculator,
    LineChart,
    PieChart,
    Sparkles,
    type LucideIcon,
} from "lucide-react"
import { PLANS, annualSavingsPercent, priceString } from "@finnacalc/shared/plans"
import { CalculatorWidget } from "@/components/calculator-widget"
import { SecurityGrid } from "@/components/site"
import { Button } from "@/components/ui"
import { appUrl, signUpUrl } from "@/lib/app-url"

/**
 * The public landing page: safety before value, and value before the ask.
 *
 * The hero states what the product computes and for whom, the calculator below
 * it works for anyone who scrolls to it with no account at all, and the only
 * gate on the page is saving a scenario — the one action that genuinely needs
 * somewhere to save it.
 *
 * Figures quoted here are counted, not claimed: prices come from the shared
 * plan catalog the app bills from, and there is no usage metric on the page
 * because there is no usage figure anyone has verified.
 */
export default function LandingPage() {
    return (
        <>
            {/* ── Hero ─────────────────────────────────────────────────── */}
            <section className="border-b border-border bg-sunken">
                <div className="mx-auto flex max-w-4xl flex-col items-center gap-7 px-6 py-20 text-center lg:py-28">
                    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-semibold text-muted-foreground">
                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                        Budgeting · Investing · Taxes · Eleven free calculators
                    </span>

                    <h1 className="text-[clamp(2.5rem,6.5vw,4.5rem)] font-bold leading-[0.98] tracking-[-0.03em] text-foreground">
                        Real-time financial modelling,
                        <br className="hidden sm:block" /> without the spreadsheet.
                    </h1>

                    <p className="max-w-2xl text-xl leading-relaxed text-muted-foreground">
                        For people who want the arithmetic shown, not hidden: freelancers sizing a runway,
                        households pacing a mortgage, and small businesses working out what a hire really
                        costs. Model it here, then keep it in your account.
                    </p>

                    <div className="flex flex-col items-center gap-3">
                        <a href="#calculator">
                            <Button size="lg">Try the interactive calculator</Button>
                        </a>
                        <p className="text-sm text-muted-foreground">
                            No credit card required · No account needed to start
                        </p>
                    </div>

                    {/* Trust signals sit in the fold, but only true ones. */}
                    <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-2 text-sm text-muted-foreground">
                        <li>TLS encrypted end to end</li>
                        <li aria-hidden="true">·</li>
                        <li>Bank logins handled by Plaid, never by us</li>
                        <li aria-hidden="true">·</li>
                        <li>Budgets stored on your device</li>
                    </ul>
                </div>
            </section>

            {/* ── Un-gated calculator ──────────────────────────────────── */}
            <section id="calculator" className="border-b border-border">
                <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-20">
                    <div className="flex max-w-2xl flex-col gap-3">
                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                            Try it now
                        </p>
                        <h2 className="text-[clamp(1.85rem,4vw,2.75rem)] font-bold leading-[1.08] tracking-[-0.02em] text-foreground">
                            Drag the sliders. Watch the money compound.
                        </h2>
                        <p className="text-lg leading-relaxed text-muted-foreground">
                            No sign-up, no email, nothing stored. This is the same compound-interest engine
                            the app runs, so the figure here is the figure you keep.
                        </p>
                    </div>

                    <CalculatorWidget />
                </div>
            </section>

            {/* ── What's in it ─────────────────────────────────────────── */}
            <section id="features" className="border-b border-border bg-sunken">
                <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-20">
                    <div className="flex max-w-2xl flex-col gap-3">
                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                            The platform
                        </p>
                        <h2 className="text-[clamp(1.85rem,4vw,2.75rem)] font-bold leading-[1.08] tracking-[-0.02em] text-foreground">
                            One account, the whole picture.
                        </h2>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <Feature
                            icon={PieChart}
                            title="Budgeting"
                            body="Build a budget by hand or connect your bank through Plaid. Category caps, savings goals, recurring-charge detection and a month-by-month history."
                            href={appUrl("/budgeting")}
                        />
                        <Feature
                            icon={LineChart}
                            title="Investing"
                            body="Live quotes and charts, a screener, your watchlist, and — with a brokerage connected — your real holdings, cost basis, and orders you review before they go anywhere."
                            href={appUrl("/investing")}
                        />
                        <Feature
                            icon={Calculator}
                            title="Eleven calculators"
                            body="Loans, retirement, compound interest, emergency fund, break-even, ROI, margins and more. Free, un-gated, and they never leave your browser."
                            href={appUrl("/calculators")}
                        />
                        <Feature
                            icon={BookOpen}
                            title="Education"
                            body="Short lessons on credit, investing, budgeting, retirement and taxes, in plain language. Watch or read."
                            href={appUrl("/education")}
                        />
                    </div>
                </div>
            </section>

            <SecurityGrid />

            {/* ── Pricing ──────────────────────────────────────────────── */}
            <section id="pricing" className="border-b border-border">
                <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-20">
                    <div className="flex max-w-2xl flex-col gap-3">
                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                            Pricing
                        </p>
                        <h2 className="text-[clamp(1.85rem,4vw,2.75rem)] font-bold leading-[1.08] tracking-[-0.02em] text-foreground">
                            Free at the core. Paid where it automates.
                        </h2>
                        <p className="text-lg leading-relaxed text-muted-foreground">
                            Calculators, budgets, goals, lessons and market research cost nothing. Plans add
                            bank automation, deeper analysis and portfolio tooling.
                        </p>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-3">
                        {PLANS.map((plan) => (
                            <div
                                key={plan.tier}
                                className={
                                    plan.recommended
                                        ? "flex flex-col gap-4 rounded-2xl bg-foreground p-6 text-background shadow-lg"
                                        : "flex flex-col gap-4 rounded-2xl border border-border bg-card p-6"
                                }
                            >
                                <div className="flex flex-col gap-1">
                                    <p className="text-lg font-bold">{plan.name}</p>
                                    <p
                                        className={
                                            plan.recommended
                                                ? "text-sm opacity-75"
                                                : "text-sm text-muted-foreground"
                                        }
                                    >
                                        {plan.tagline}
                                    </p>
                                </div>
                                <p className="figure text-3xl font-bold">
                                    {priceString(plan.monthly)}
                                    <span
                                        className={
                                            plan.recommended
                                                ? "text-sm font-normal opacity-70"
                                                : "text-sm font-normal text-muted-foreground"
                                        }
                                    >
                                        /month
                                    </span>
                                </p>
                                <p
                                    className={
                                        plan.recommended
                                            ? "text-xs opacity-75"
                                            : "text-xs text-muted-foreground"
                                    }
                                >
                                    {priceString(plan.annual)} a year — saves {annualSavingsPercent(plan)}%
                                </p>
                                <ul className="flex flex-col gap-2 pt-1">
                                    {plan.benefits.map((benefit) => (
                                        <li key={benefit.text} className="flex gap-2 text-sm">
                                            <span
                                                className={
                                                    plan.recommended
                                                        ? "mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-background/60"
                                                        : "mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                                                }
                                            />
                                            <span className={plan.recommended ? "opacity-90" : "text-body"}>
                                                {benefit.text}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                                <a href={appUrl("/plans")} className="mt-auto pt-2">
                                    <Button
                                        variant={plan.recommended ? "primary" : "outline"}
                                        className="w-full"
                                    >
                                        See {plan.name}
                                    </Button>
                                </a>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Close ────────────────────────────────────────────────── */}
            <section className="bg-foreground text-background">
                <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-6 py-20 text-center">
                    <h2 className="text-[clamp(1.85rem,4.5vw,3rem)] font-bold leading-[1.05] tracking-[-0.02em]">
                        Start with a number you were going to look up anyway.
                    </h2>
                    <p className="max-w-xl text-lg opacity-80">
                        The calculators are free and need no account. Everything else is there when you want
                        it.
                    </p>
                    <div className="flex flex-wrap justify-center gap-3">
                        <a href={signUpUrl()}>
                            <Button size="lg">Start free</Button>
                        </a>
                        <Link href="#calculator">
                            <Button variant="outline" size="lg" className="border-background/40 text-background">
                                Back to the calculator
                            </Button>
                        </Link>
                    </div>
                </div>
            </section>
        </>
    )
}

function Feature({
    icon: Icon,
    title,
    body,
    href,
}: {
    icon: LucideIcon
    title: string
    body: string
    href: string
}) {
    return (
        <a
            href={href}
            className="flex h-full flex-col gap-3 rounded-2xl border border-border bg-card p-6 transition hover:border-border-strong"
        >
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary/12 text-primary">
                <Icon className="h-5 w-5" />
            </span>
            <p className="text-xl font-bold text-foreground">{title}</p>
            <p className="text-base leading-relaxed text-muted-foreground">{body}</p>
        </a>
    )
}
