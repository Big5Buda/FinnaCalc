import Link from "next/link"
import { PLANS, annualSavingsPercent, priceString } from "@finnacalc/shared/plans"
import { Rise, Stagger } from "@/components/motion"
import { Hero } from "@/app/(marketing)/components/hero"
import { Features } from "@/app/(marketing)/components/features"
import { CalculatorWidget } from "@/components/calculator-widget"
import { SecurityGrid } from "@/components/site"
import { Button } from "@/components/ui/button"
import { appUrl, signUpUrl } from "@/lib/app-url"

/**
 * The public landing page: safety before value, and value before the ask.
 *
 * The hero runs the product rather than describing it, the calculator below
 * works for anyone who scrolls to it with no account at all, and the only gate
 * on the page is saving a scenario — the one action that genuinely needs
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
            <Hero />

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

            <Features />

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
                                            ? "flex h-full flex-col gap-4 rounded-2xl border border-mint/40 bg-surface-elevated p-6 shadow-[0_0_40px_-12px_rgb(var(--mint)/0.35)]"
                                            : "flex h-full flex-col gap-4 rounded-2xl border border-line bg-surface-elevated p-6"
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
            <section className="bg-mesh-surface">
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
