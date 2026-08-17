import Link from "next/link"
import { BookOpen, Calculator, LineChart, PieChart, Sparkles, type LucideIcon } from "lucide-react"
import { PLANS, annualSavingsPercent, priceString } from "@finnacalc/shared/plans"
import { Rise, Stagger } from "@/components/motion"
import { CalculatorWidget } from "@/components/calculator-widget"
import { SecurityGrid } from "@/components/site"
import { Button } from "@/components/ui/button"
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
 *
 * Every section is one Stagger: the group reveals as a single gesture rather
 * than each card animating on its own as it crosses the fold.
 */
export default function LandingPage() {
    return (
        <>
            {/* ── Hero ─────────────────────────────────────────────────── */}
            <section className="border-b border-line bg-surface/30">
                <Stagger className="mx-auto flex max-w-4xl flex-col items-center gap-7 px-6 py-24 text-center lg:py-32">
                    <Rise>
                        <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs font-medium text-ink-muted">
                            <Sparkles className="h-3.5 w-3.5 text-mint" />
                            Budgeting · Investing · Taxes · Eleven free calculators
                        </span>
                    </Rise>

                    {/* The weight contrast the system runs on: extralight
                        supporting line, black on the words that carry it. */}
                    <Rise>
                        <h1 className="font-display text-[clamp(2.5rem,6.5vw,4.75rem)] leading-[0.96] tracking-[-0.03em] text-ink">
                            <span className="font-extralight">Real-time</span>{" "}
                            <span className="font-black">financial modelling</span>
                            <span className="block font-extralight">without the spreadsheet.</span>
                        </h1>
                    </Rise>

                    <Rise>
                        <p className="max-w-2xl text-xl font-extralight leading-relaxed text-ink-muted">
                            For people who want the arithmetic shown, not hidden: freelancers sizing a runway,
                            households pacing a mortgage, and small businesses working out what a hire really
                            costs. Model it here, then keep it in your account.
                        </p>
                    </Rise>

                    <Rise className="flex flex-col items-center gap-3">
                        <Button asChild size="lg" className="rounded-full px-8 text-base font-bold">
                            <a href="#calculator">Try the interactive calculator</a>
                        </Button>
                        <p className="text-sm font-light text-ink-muted">
                            No credit card required · No account needed to start
                        </p>
                    </Rise>

                    {/* Trust signals sit in the fold, but only true ones. */}
                    <Rise>
                        <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-2 text-sm font-light text-ink-muted">
                            <li>TLS encrypted end to end</li>
                            <li aria-hidden="true">·</li>
                            <li>Bank logins handled by Plaid, never by us</li>
                            <li aria-hidden="true">·</li>
                            <li>Budgets stored on your device</li>
                        </ul>
                    </Rise>
                </Stagger>
            </section>

            {/* ── Un-gated calculator ──────────────────────────────────── */}
            <section id="calculator" className="border-b border-line">
                <Stagger className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-24">
                    <Rise className="flex max-w-2xl flex-col gap-3">
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-mint">Try it now</p>
                        <h2 className="font-display text-[clamp(1.85rem,4.4vw,3rem)] font-black leading-[1.04] tracking-[-0.02em] text-ink">
                            Drag the sliders. Watch the money compound.
                        </h2>
                        <p className="text-lg font-extralight leading-relaxed text-ink-muted">
                            No sign-up, no email, nothing stored. This is the same compound-interest engine
                            the app runs, so the figure here is the figure you keep.
                        </p>
                    </Rise>

                    <Rise>
                        <CalculatorWidget />
                    </Rise>
                </Stagger>
            </section>

            {/* ── What's in it ─────────────────────────────────────────── */}
            <section id="features" className="border-b border-line bg-surface/30">
                <Stagger className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-24">
                    <Rise className="flex max-w-2xl flex-col gap-3">
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-mint">The platform</p>
                        <h2 className="font-display text-[clamp(1.85rem,4.4vw,3rem)] font-black leading-[1.04] tracking-[-0.02em] text-ink">
                            One account, the whole picture.
                        </h2>
                    </Rise>

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
                </Stagger>
            </section>

            <SecurityGrid />

            {/* ── Pricing ──────────────────────────────────────────────── */}
            <section id="pricing" className="border-b border-line">
                <Stagger className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-24">
                    <Rise className="flex max-w-2xl flex-col gap-3">
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-mint">Pricing</p>
                        <h2 className="font-display text-[clamp(1.85rem,4.4vw,3rem)] font-black leading-[1.04] tracking-[-0.02em] text-ink">
                            Free at the core. Paid where it automates.
                        </h2>
                        <p className="text-lg font-extralight leading-relaxed text-ink-muted">
                            Calculators, budgets, goals, lessons and market research cost nothing. Plans add
                            bank automation, deeper analysis and portfolio tooling.
                        </p>
                    </Rise>

                    <div className="grid gap-4 lg:grid-cols-3">
                        {PLANS.map((plan) => (
                            <Rise key={plan.tier} className="h-full">
                                <div
                                    className={
                                        plan.recommended
                                            ? "flex h-full flex-col gap-4 rounded-2xl border border-mint/40 bg-surface p-6 shadow-[0_0_40px_-12px_rgb(var(--mint)/0.35)]"
                                            : "flex h-full flex-col gap-4 rounded-2xl border border-line bg-surface p-6"
                                    }
                                >
                                    <div className="flex flex-col gap-1">
                                        <p className="font-display text-lg font-black text-ink">{plan.name}</p>
                                        <p className="text-sm font-extralight text-ink-muted">{plan.tagline}</p>
                                    </div>
                                    {/* Prices are figures: mono, tabular, and the
                                        recommended plan's carries the mint. */}
                                    <p
                                        className={
                                            plan.recommended
                                                ? "figure text-3xl font-black text-mint"
                                                : "figure text-3xl font-black text-ink"
                                        }
                                    >
                                        {priceString(plan.monthly)}
                                        <span className="text-sm font-extralight text-ink-muted">/month</span>
                                    </p>
                                    <p className="figure text-xs font-light text-ink-muted">
                                        {priceString(plan.annual)} a year — saves {annualSavingsPercent(plan)}%
                                    </p>
                                    <ul className="flex flex-col gap-2 pt-1">
                                        {plan.benefits.map((benefit) => (
                                            <li key={benefit.text} className="flex gap-2 text-sm font-light">
                                                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-mint" />
                                                <span className="text-ink-muted">{benefit.text}</span>
                                            </li>
                                        ))}
                                    </ul>
                                    <Button
                                        asChild
                                        variant={plan.recommended ? "default" : "outline"}
                                        className="mt-auto w-full rounded-full font-bold"
                                    >
                                        <a href={appUrl("/plans")}>See {plan.name}</a>
                                    </Button>
                                </div>
                            </Rise>
                        ))}
                    </div>
                </Stagger>
            </section>

            {/* ── Close ────────────────────────────────────────────────── */}
            <section className="bg-surface">
                <Stagger className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-6 py-24 text-center">
                    <Rise>
                        <h2 className="font-display text-[clamp(1.85rem,4.6vw,3.25rem)] leading-[1.04] tracking-[-0.02em] text-ink">
                            <span className="font-extralight">Start with a number you were</span>{" "}
                            <span className="font-black">going to look up anyway.</span>
                        </h2>
                    </Rise>
                    <Rise>
                        <p className="max-w-xl text-lg font-extralight text-ink-muted">
                            The calculators are free and need no account. Everything else is there when you
                            want it.
                        </p>
                    </Rise>
                    <Rise className="flex flex-wrap justify-center gap-3">
                        <Button asChild size="lg" className="rounded-full px-8 font-bold">
                            <a href={signUpUrl()}>Start free</a>
                        </Button>
                        <Button asChild variant="outline" size="lg" className="rounded-full px-8">
                            <Link href="#calculator">Back to the calculator</Link>
                        </Button>
                    </Rise>
                </Stagger>
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
        <Rise className="h-full">
            <a
                href={href}
                className="flex h-full flex-col gap-3 rounded-2xl border border-line bg-surface p-6 transition-colors hover:border-mint/40"
            >
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-mint/12 text-mint">
                    <Icon className="h-5 w-5" />
                </span>
                <p className="font-display text-xl font-black text-ink">{title}</p>
                <p className="text-base font-extralight leading-relaxed text-ink-muted">{body}</p>
            </a>
        </Rise>
    )
}
