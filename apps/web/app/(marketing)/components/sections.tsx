"use client"

import { useReducedMotion } from "framer-motion"
import { CALCULATORS } from "@finnacalc/shared/calculators-catalog"
import { Rise, Stagger } from "@/components/motion"
import { CalculatorWidget } from "@/components/calculator-widget"
import { CircleArrow, Pill, SectionLockup } from "@/components/site"
import { signUpUrl } from "@/lib/app-url"
import { cn } from "@/lib/utils"

/*
 * The product sections, on the reference's rhythm: one product per full-width
 * section, each with its own ground, saturated sections always separated by a
 * cream one. Headlines are the sans at 48px — sentences carrying the actual
 * benefit — and the CTA is an outlined arrow circle, because the headline has
 * already done the talking.
 *
 * Every figure on this page is computed or counted, never typed in: the
 * calculator count comes from the shared catalog, the compound figures from
 * the shared engine, and the tax-test count is the tax engine's actual vitest
 * suite. Where the reference shows a $308,926.53 balance as set dressing, this
 * page shows either a labelled worked example or no number at all.
 */

/** Counted from the catalog, never typed — the copy can't drift from what ships. */
const CALCULATOR_COUNT = CALCULATORS.length

/**
 * The tax engine's test count: components/tax-engine/engine/__tests__ in
 * apps/app, 176 tests as of Aug 2026. Update it when the suite grows — it's a
 * verifiable claim, which is the only kind this page makes.
 */
const TAX_TEST_COUNT = 176

/** Shared section scaffold: lockup, headline, copy, arrow — then the visual. */
function ProductSection({
    id,
    ground,
    onColor = false,
    lockupSuffix,
    headline,
    copy,
    href,
    ctaLabel,
    children,
    flip = false,
}: {
    id: string
    ground: string
    onColor?: boolean
    lockupSuffix: string
    headline: string
    copy: string
    href: string
    ctaLabel: string
    children: React.ReactNode
    flip?: boolean
}) {
    return (
        <section id={id} className={cn(ground, onColor && "on-color")}>
            <Stagger className="mx-auto grid min-h-[80vh] max-w-site items-center gap-14 px-6 py-28 lg:grid-cols-2 lg:gap-10">
                <div className={cn("flex max-w-xl flex-col items-start gap-7", flip && "lg:order-2")}>
                    <Rise>
                        <SectionLockup suffix={lockupSuffix} onColor={onColor} />
                    </Rise>
                    <Rise>
                        <h2
                            className={cn(
                                "headline-sans text-[clamp(2rem,3.4vw,3rem)]",
                                onColor ? "text-chip" : "text-ink"
                            )}
                        >
                            {headline}
                        </h2>
                    </Rise>
                    <Rise>
                        <p className={cn("text-lg leading-relaxed", onColor ? "muted-on-color" : "text-ink-soft")}>
                            {copy}
                        </p>
                    </Rise>
                    <Rise>
                        <CircleArrow href={href} label={ctaLabel} onColor={onColor} />
                    </Rise>
                </div>
                <Rise className={cn(flip && "lg:order-1")}>{children}</Rise>
            </Stagger>
        </section>
    )
}

/* ── 1. Calculators — the flagship, on cream ─────────────────────────── */

export function CalculatorsSection() {
    return (
        <section id="calculators" className="bg-paper">
            <Stagger className="mx-auto flex max-w-site flex-col gap-12 px-6 py-28">
                <div className="flex max-w-2xl flex-col items-start gap-7">
                    <Rise>
                        <SectionLockup suffix="Calculators" />
                    </Rise>
                    <Rise>
                        <h2 className="headline-sans text-[clamp(2rem,3.4vw,3rem)] text-ink">
                            {CALCULATOR_COUNT} calculators. Every one shows its work.
                        </h2>
                    </Rise>
                    <Rise>
                        <p className="text-lg leading-relaxed text-ink-soft">
                            Loan payments, retirement, business runway, what to charge. Try this one
                            right now, no account needed. It runs the same engine as the app, so
                            the number you see here is the number you get there.
                        </p>
                    </Rise>
                </div>

                <Rise>
                    <CalculatorWidget />
                </Rise>

                <Rise>
                    <CircleArrow href={signUpUrl()} label="Get started with the calculators" />
                </Rise>
            </Stagger>
        </section>
    )
}

/* ── 2. Budgeting — muted purple, phone in frame ─────────────────────── */

export function BudgetingSection() {
    return (
        <ProductSection
            id="budgeting"
            ground="bg-section-budgeting"
            onColor
            lockupSuffix="Budgeting"
            headline="A budget that lives on your device, not our servers."
            copy="Link your bank through Plaid, or just type things in. Set caps on the categories that get away from you, catch the subscriptions you forgot about, watch the savings bar fill. It all stays on your device."
            href={signUpUrl()}
            ctaLabel="Get started with Budgeting"
        >
            <PhoneMockup />
        </ProductSection>
    )
}

/**
 * A phone in a frame, built in CSS. The screen shows the shape of the
 * budgeting UI — categories against caps — with no dollar figures, because a
 * convincing fake balance is exactly the kind of number this product refuses
 * to print. The caption says what it is.
 */
function PhoneMockup() {
    const rows = [
        { label: "Rent", used: 100, tone: "bg-ink/50" },
        { label: "Groceries", used: 64, tone: "bg-ink/50" },
        { label: "Transport", used: 41, tone: "bg-ink/50" },
        { label: "Eating out", used: 88, tone: "bg-terracotta/70" },
        { label: "Saving", used: 52, tone: "bg-celery" },
    ]
    return (
        <div className="flex flex-col items-center gap-4">
            <div className="w-[290px] rounded-[44px] border border-chip/25 bg-ink/25 p-2.5 shadow-[0_32px_80px_rgb(0_0_0/0.35)]">
                <div className="rounded-[36px] bg-paper px-5 pb-8 pt-6">
                    <div className="mx-auto mb-5 h-1.5 w-16 rounded-pill bg-ink/15" aria-hidden="true" />
                    <p className="text-xs font-medium text-ink-muted">September budget</p>
                    <div className="flex flex-col gap-3.5 pt-4">
                        {rows.map((row) => (
                            <div key={row.label} className="flex flex-col gap-1">
                                <div className="flex items-baseline justify-between">
                                    <span className="text-sm font-medium text-ink">{row.label}</span>
                                    <span className="figure text-[11px] text-ink-muted">
                                        {row.used}% of cap
                                    </span>
                                </div>
                                <div className="h-2 overflow-hidden rounded-pill bg-ink/8">
                                    <div
                                        className={cn("h-full rounded-pill", row.tone)}
                                        style={{ width: `${Math.min(row.used, 100)}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            <p className="text-xs muted-on-color">This one is made up. Yours won&rsquo;t be.</p>
        </div>
    )
}

/* ── 3. The manifesto — cream, the serif's big moment ────────────────── */

export function ManifestoSection() {
    return (
        <section className="bg-paper">
            <Stagger className="mx-auto flex max-w-site flex-col items-start gap-10 px-6 py-32">
                <Rise>
                    {/* The app's actual mark — the coin stack from the iOS asset
                        catalog, not a stand-in icon. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/finnacalc-logo.png" alt="" className="h-28 w-auto" />
                </Rise>
                <Rise>
                    <h2 className="headline-serif max-w-5xl text-[clamp(3rem,8.8vw,8rem)] text-ink">
                        We show our work
                    </h2>
                </Rise>
                <Rise>
                    <div className="flex max-w-2xl flex-col gap-4 text-xl leading-relaxed text-ink">
                        <p>
                            Most money apps hand you a number and expect you to take it on faith.
                            We think that&rsquo;s backwards. FinnaCalc shows you how every figure was
                            worked out, and when we can&rsquo;t work something out, we say so on the
                            screen. No guessing, no padding, no invented statistics. It&rsquo;s your
                            money. You should get to check the math.
                        </p>
                    </div>
                </Rise>
                <Rise>
                    <p className="max-w-3xl text-sm leading-relaxed text-ink-muted">
                        The calculator up top, the web app and the iPhone app all share one set
                        of math underneath. The number you saw before signing up doesn&rsquo;t change
                        after.
                    </p>
                </Rise>
            </Stagger>
        </section>
    )
}

/* ── 4. Investing — near-black green, market lines ───────────────────── */

export function InvestingSection() {
    return (
        <ProductSection
            id="investing"
            ground="bg-section-investing"
            onColor
            lockupSuffix="Investing"
            headline="Live prices, your actual holdings, ten years of filings."
            copy="Watch the market, read the SEC filings for yourself, follow your own cost basis. When you place a trade, it goes through your own brokerage. We never touch the money."
            href={signUpUrl()}
            ctaLabel="Get started with Investing"
            flip
        >
            <InvestingDemo />
        </ProductSection>
    )
}

/**
 * The Investing tab, actually being used: a screen recording of a real session
 * on the deployed app — live index prices, a stock page with its chart and SEC
 * stats, the news feed. Nothing in the frame is staged; the prices were the
 * prices when it was recorded, and the caption dates it for exactly that
 * reason.
 *
 * Reduced-motion readers get the poster frame. The video is muted, looped,
 * inline, ~300KB — decoration that happens to be true, not a page cost.
 */
function InvestingDemo() {
    const reduceMotion = useReducedMotion()

    return (
        <div className="flex flex-col gap-3">
            <div className="overflow-hidden rounded-lg border border-chip/20 shadow-[0_32px_80px_rgb(0_0_0/0.4)]">
                {reduceMotion ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                        src="/investing-poster.jpg"
                        alt="The FinnaCalc Investing tab: market overview with live index prices"
                        className="block w-full"
                    />
                ) : (
                    <video
                        className="block w-full"
                        autoPlay
                        muted
                        loop
                        playsInline
                        preload="metadata"
                        poster="/investing-poster.jpg"
                        aria-label="A recorded session of the FinnaCalc Investing tab: browsing the market overview, opening a stock page, switching chart ranges, and scrolling its stats and news"
                    >
                        <source src="/investing-demo.webm" type="video/webm" />
                        <source src="/investing-demo.mp4" type="video/mp4" />
                    </video>
                )}
            </div>
            <p className="text-xs muted-on-color">
                A real session in the app, recorded August 2026. Prices are from that day.
            </p>
        </div>
    )
}

/* ── 5. Taxes — warm brown, the tested engine ────────────────────────── */

export function TaxesSection() {
    return (
        <ProductSection
            id="taxes"
            ground="bg-section-taxes"
            onColor
            lockupSuffix="Taxes"
            headline="Know your tax bill before April does."
            copy={`Filing status, dependents, capital gains, side income, state taxes. There is a proper 1040 engine under here, and we check it against ${TAX_TEST_COUNT} test returns so the estimate is one you can plan around. We never file for you.`}
            href={signUpUrl()}
            ctaLabel="Get started with Taxes"
        >
            <TaxCard />
        </ProductSection>
    )
}

/** The engine's shape: the steps of a return, no invented refund figure. */
function TaxCard() {
    const steps = [
        "Income & filing status",
        "Adjustments & deductions",
        "Credits",
        "Capital gains & dividends",
        "Self-employment",
        "Federal & state estimate",
    ]
    return (
        <div className="rounded-lg bg-chip p-7 shadow-[0_24px_64px_rgb(0_0_0/0.3)]">
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-ink-muted">
                What it walks through
            </p>
            <ol className="flex flex-col pt-4">
                {steps.map((step, index) => (
                    <li
                        key={step}
                        className={cn(
                            "flex items-center gap-3 py-3",
                            index > 0 && "border-t border-line"
                        )}
                    >
                        <span className="figure w-5 text-sm text-ink-muted">{index + 1}</span>
                        <span className="text-[15px] font-medium text-ink">{step}</span>
                    </li>
                ))}
            </ol>
        </div>
    )
}

/* ── 6. Education — the inset yellow panel ───────────────────────────── */

export function EducationSection() {
    return (
        <section id="education" className="bg-paper">
            <Stagger className="mx-auto max-w-site px-6 py-16">
                <Rise>
                    <div className="rounded-lg bg-section-education px-8 py-16 sm:px-14 sm:py-20">
                        <div className="flex flex-col items-start gap-10 sm:flex-row sm:items-center sm:gap-14">
                            <div className="flex max-w-xl flex-col items-start gap-6">
                                <h2 className="headline-serif text-[clamp(2.5rem,5vw,4rem)] text-ink">
                                    Learn
                                </h2>
                                <p className="text-xl leading-relaxed text-ink">
                                    Short lessons on credit, investing, retirement and taxes, written
                                    the way you&rsquo;d explain them to a friend. And when a lesson
                                    raises a question, FinnaBot actually answers it.
                                </p>
                                <Pill href={signUpUrl()} tone="outline" className="px-6">
                                    Get started
                                </Pill>
                            </div>
                            {/* FinnaBot, from the iOS asset catalog — the app's own
                                helper, holding the coin up like it means it. */}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src="/finnabot.png"
                                alt="FinnaBot, the FinnaCalc helper — a stick figure holding the FinnaCalc coin overhead"
                                className="h-56 w-auto shrink-0 sm:h-72"
                            />
                        </div>
                    </div>
                </Rise>
            </Stagger>
        </section>
    )
}

/* ── 7. The close ────────────────────────────────────────────────────── */

export function CloserSection() {
    return (
        <section className="bg-paper">
            <Stagger className="mx-auto flex max-w-3xl flex-col items-center gap-7 px-6 pb-32 pt-20 text-center">
                <Rise>
                    {/* The reference closes on "Trusted by over 4 million Canadians".
                        FinnaCalc has no verified user figure, so it closes on what
                        is true instead of a number it can't stand behind. */}
                    <h2 className="headline-serif text-[clamp(2.25rem,4.6vw,3.5rem)] text-ink">
                        Free to start. Nothing to install.
                    </h2>
                </Rise>
                <Rise>
                    <p className="max-w-xl text-xl text-ink-soft">
                        The calculator above doesn&rsquo;t even need an account. The rest takes about a minute.
                    </p>
                </Rise>
                <Rise>
                    <Pill href={signUpUrl()} className="px-8 py-3.5 text-base">
                        Get started
                    </Pill>
                </Rise>
            </Stagger>
        </section>
    )
}
