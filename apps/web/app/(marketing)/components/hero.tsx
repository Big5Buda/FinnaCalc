"use client"

import { useMemo, useState } from "react"
import { compoundInterestSeries, crossoverYear } from "@finnacalc/shared/calculators"
import { compactMoney, currency } from "@finnacalc/shared/format"
import { Rise, Stagger } from "@/components/motion"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { signUpUrl } from "@/lib/app-url"
import { cn } from "@/lib/utils"

/**
 * The hero is the thesis: instead of describing the product, it runs it.
 *
 * The claim FinnaCalc makes is that compounding is worth modelling precisely,
 * so the hero models it — one slider, live figures, and the arithmetic visible.
 * The reader tests the claim before reading a word of marketing.
 *
 * The signature is the contribution stack: what you paid in against what
 * compounding added, side by side, with the crossover marked — the year the
 * returns start doing more work than the deposits. That year moves as you drag,
 * which is the whole argument in one gesture.
 *
 * Deliberately not a line chart: the section below already draws one, and a
 * second would say the same thing twice in the same shape.
 */

/** Fixed and stated in the copy, so the figures can't be read as a promise. */
const RATE = 7
const HORIZON = 20
const DEFAULT_MONTHLY = 2000

export function Hero() {
    const [monthly, setMonthly] = useState(DEFAULT_MONTHLY)

    const { balance, contributed, growth, crossover, growthShare } = useMemo(() => {
        const series = compoundInterestSeries({
            initialDeposit: 0,
            monthlyContribution: monthly,
            annualRate: RATE,
            years: HORIZON,
        })
        const last = series[series.length - 1]
        return {
            balance: last.balance,
            contributed: last.contributed,
            growth: last.growth,
            crossover: crossoverYear(series),
            growthShare: last.balance > 0 ? last.growth / last.balance : 0,
        }
    }, [monthly])

    return (
        <section className="bg-mesh-atmosphere">
            <Stagger className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-24 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:py-32">
                {/* ── The claim ─────────────────────────────────────────── */}
                <div className="flex flex-col gap-7">
                    <Rise>
                        <p className="figure text-xs uppercase tracking-[0.22em] text-mint">
                            Compound modelling
                        </p>
                    </Rise>

                    <Rise>
                        <h1 className="font-display text-[clamp(2.75rem,6vw,4.5rem)] leading-[0.94] tracking-[-0.035em] text-ink">
                            <span className="font-black">Precision wealth modeling</span>{" "}
                            <span className="font-extralight italic">for founders.</span>
                        </h1>
                    </Rise>

                    <Rise>
                        <p className="max-w-md text-lg font-extralight leading-relaxed text-ink-muted">
                            Income that arrives in lumps is hard to plan against. Model what a contribution
                            actually becomes — with the arithmetic shown, not a number pulled from a brochure.
                        </p>
                    </Rise>

                    <Rise className="flex flex-wrap items-center gap-3">
                        <Button asChild size="lg" className="rounded-full px-8 font-bold">
                            <a href={signUpUrl()}>Start free</a>
                        </Button>
                        <Button asChild variant="ghost" size="lg" className="rounded-full px-6">
                            <a href="#calculator">Open the full model</a>
                        </Button>
                    </Rise>

                    <Rise>
                        <p className="text-sm font-light text-ink-muted">
                            No credit card. No account needed to use the calculators.
                        </p>
                    </Rise>
                </div>

                {/* ── The thesis, running ───────────────────────────────── */}
                <Rise>
                    <div className="rounded-2xl border border-white/10 bg-surface-elevated/40 p-6 backdrop-blur-md sm:p-8">
                        <div className="flex items-baseline justify-between gap-4">
                            <label
                                htmlFor="hero-contribution"
                                className="text-sm font-light text-ink-muted"
                            >
                                Set aside each month
                            </label>
                            <output
                                htmlFor="hero-contribution"
                                className="text-2xl font-black text-ink"
                            >
                                {currency(monthly)}
                            </output>
                        </div>

                        <div className="pt-5">
                            <Slider
                                id="hero-contribution"
                                aria-label="Monthly contribution"
                                aria-valuetext={`${currency(monthly)} a month`}
                                value={[monthly]}
                                onValueChange={([next]) => setMonthly(next)}
                                min={0}
                                max={10000}
                                step={50}
                            />
                            <div className="flex justify-between pt-2">
                                <span className="figure text-[11px] text-ink-muted">$0</span>
                                <span className="figure text-[11px] text-ink-muted">$10,000</span>
                            </div>
                        </div>

                        {/* The divider separates what the reader controls from what
                            the model returns. That split is the actual hierarchy
                            here, so it earns a rule. */}
                        <div className="divider-fade my-7" aria-hidden="true" />

                        <p className="text-sm font-light text-ink-muted">
                            After {HORIZON} years at {RATE}% a year
                        </p>
                        <output className="mt-1 block text-[clamp(2.25rem,5vw,3.25rem)] font-black leading-none text-mint">
                            {compactMoney(balance)}
                        </output>

                        <ContributionStack contributed={contributed} growth={growth} />

                        <dl className="grid grid-cols-2 gap-4 pt-5">
                            <div className="flex flex-col gap-0.5">
                                <dt className="text-xs font-light text-ink-muted">You put in</dt>
                                <dd className="figure text-lg font-bold text-ink">
                                    {compactMoney(contributed)}
                                </dd>
                            </div>
                            <div className="flex flex-col gap-0.5">
                                <dt className="text-xs font-light text-ink-muted">Compounding added</dt>
                                <dd className="figure text-lg font-bold text-mint">
                                    {compactMoney(growth)}
                                </dd>
                            </div>
                        </dl>

                        <p className="pt-4 text-sm font-light leading-relaxed text-ink-muted">
                            {crossover !== null ? (
                                <>
                                    Growth overtakes your deposits in{" "}
                                    <span className="figure font-bold text-ink">year {crossover}</span> — from
                                    then on the returns are contributing more than you are, and end up{" "}
                                    <span className="figure font-bold text-ink">
                                        {Math.round(growthShare * 100)}%
                                    </span>{" "}
                                    of the balance.
                                </>
                            ) : (
                                <>
                                    Over this window your deposits stay ahead of the growth. Compounding
                                    overtakes them on a longer horizon, or at a higher return than {RATE}%.
                                </>
                            )}
                        </p>

                        <p className="pt-4 text-xs font-extralight leading-relaxed text-ink-muted">
                            A projection, not a promise: {RATE}% compounded monthly, held steady. Real returns
                            vary year to year and can be negative.
                        </p>
                    </div>
                </Rise>
            </Stagger>
            <div className="divider-fade" aria-hidden="true" />
        </section>
    )
}

/**
 * Deposits against growth, as one bar. The mint half is the argument: it starts
 * as a sliver and takes over the bar as the horizon does its work.
 */
function ContributionStack({ contributed, growth }: { contributed: number; growth: number }) {
    const total = contributed + growth
    const contributedShare = total > 0 ? (contributed / total) * 100 : 100

    return (
        <div className="pt-6">
            <div
                className="flex h-3 w-full overflow-hidden rounded-full bg-surface"
                role="img"
                aria-label={`${compactMoney(contributed)} contributed, ${compactMoney(growth)} from growth`}
            >
                <div
                    className="h-full bg-ink/25 transition-[width] duration-300 ease-out motion-reduce:transition-none"
                    style={{ width: `${contributedShare}%` }}
                />
                <div
                    className={cn(
                        "h-full flex-1 bg-mint transition-[width] duration-300 ease-out",
                        "motion-reduce:transition-none"
                    )}
                />
            </div>
        </div>
    )
}
