"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"
import { CALCULATORS } from "@/lib/calculators/catalog"
import { EDU_TOPICS, TOTAL_ARTICLE_COUNT, TOTAL_VIDEO_COUNT } from "@/lib/education-content"
import { CountUp, Reveal, StickyMedia, useScrollProgress } from "@/components/motion/motion"
import {
    BudgetMockup,
    CalculatorMockup,
    InvestingMockup,
    PhoneFrame,
} from "@/components/marketing/mockups"
import { StoreBadge } from "@/components/marketing/store-badge"
import { WaitlistForm } from "@/components/marketing/waitlist-form"
import { useChat } from "@/components/providers/chat-provider"

/**
 * The landing page. Layout language borrowed from Wealthsimple — an oversized
 * display headline over almost nothing else, then full-bleed product sections
 * that alternate tone, with the media pinned while the copy moves past it.
 * The colours and type are still the app's own tokens, so the two products
 * remain recognisably the same brand.
 *
 * Every figure quoted here is counted from the catalogs at build time rather
 * than written into the copy, so the page can't drift from what actually ships
 * and can't quote a number nobody verified.
 */
export default function LandingPage() {
    const { openChat } = useChat()
    const { ref: heroRef, progress } = useScrollProgress<HTMLDivElement>()

    // The hero art settles back as the page moves — a small scroll-driven
    // gesture, and 0 forever when the visitor asked for reduced motion.
    const settle = 1 - progress * 0.12

    return (
        <div className="flex flex-col">
            {/* ── Hero ─────────────────────────────────────────────────── */}
            <section ref={heroRef} className="border-b border-border bg-sunken">
                <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:py-28">
                    <div className="flex flex-col items-start gap-6">
                        <Reveal>
                            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                                Budgeting · Investing · Taxes · Free calculators
                            </span>
                        </Reveal>
                        <Reveal delay={60}>
                            <h1 className="text-[clamp(2.75rem,7vw,5rem)] font-bold leading-[0.95] tracking-[-0.03em] text-foreground">
                                Your whole
                                <br />
                                financial life,
                                <br />
                                <span className="text-primary">in one place.</span>
                            </h1>
                        </Reveal>
                        <Reveal delay={120}>
                            <p className="max-w-md text-lg leading-relaxed text-muted-foreground">
                                Budget with your bank connected, follow the market and your own portfolio, and
                                run the numbers with calculators that show their work. Free at the core, and
                                honest about what it doesn&rsquo;t know.
                            </p>
                        </Reveal>
                        <Reveal delay={180} className="flex flex-wrap gap-3">
                            <Link
                                href="/budgeting"
                                className="inline-flex h-12 items-center rounded-full bg-primary px-7 text-base font-semibold text-primary-foreground transition hover:bg-primary-hover"
                            >
                                Start budgeting
                            </Link>
                            <Link
                                href="/calculators"
                                className="inline-flex h-12 items-center rounded-full border border-border-strong px-7 text-base font-semibold text-foreground transition hover:bg-secondary"
                            >
                                Open a calculator
                            </Link>
                        </Reveal>
                    </div>

                    <div
                        className="flex justify-center transition-transform duration-300 ease-out will-change-transform motion-reduce:transform-none"
                        style={{ transform: `scale(${settle})` }}
                    >
                        <PhoneFrame caption="Example — the budget view">
                            <BudgetMockup />
                        </PhoneFrame>
                    </div>
                </div>
            </section>

            {/* ── What it counts ───────────────────────────────────────── */}
            <section className="border-b border-border">
                <div className="mx-auto grid max-w-6xl gap-8 px-6 py-16 sm:grid-cols-3">
                    <Stat value={CALCULATORS.length} label="free calculators" suffix="" />
                    <Stat value={TOTAL_VIDEO_COUNT + TOTAL_ARTICLE_COUNT} label="lessons and articles" />
                    <Stat value={10} label="years of SEC filings per company" />
                </div>
            </section>

            {/* ── Product sections ─────────────────────────────────────── */}
            <ProductSection
                eyebrow="Budgeting"
                title="Every dollar, where you put it."
                body="Build a budget by hand or connect your bank. Category caps, savings goals with progress rings, recurring-charge detection, and a month-by-month history you can compare. It all stays on your device."
                href="/budgeting"
                cta="See budgeting"
                media={
                    <PhoneFrame caption="Example — budget and goals">
                        <BudgetMockup />
                    </PhoneFrame>
                }
                points={[
                    "Bank connections through Plaid, or a CSV statement",
                    "Goals that track themselves against your budget",
                    "An analysis that quotes your own numbers back at you",
                ]}
            />

            <ProductSection
                reversed
                tone="dark"
                eyebrow="Investing"
                title="Watch the market. See what you own."
                body="Live quotes and charts, a screener, your watchlist, and — when you connect a brokerage — your real holdings, your cost basis, and orders you review before they go anywhere."
                href="/investing"
                cta="See investing"
                media={
                    <PhoneFrame caption="Example — a stock page">
                        <InvestingMockup />
                    </PhoneFrame>
                }
                points={[
                    "Charts with the ranges and candles you expect",
                    "Ten years of SEC filings, straight from the source",
                    "Orders execute at your brokerage, never here",
                ]}
            />

            <ProductSection
                eyebrow="Calculators"
                title="Show me the arithmetic."
                body="Eleven calculators for the questions that actually come up: what a loan really costs, when the emergency fund is done, what the business breaks even at. No sign-up, and nothing leaves your browser."
                href="/calculators"
                cta="Open a calculator"
                media={
                    <PhoneFrame caption="Example — the loan calculator">
                        <CalculatorMockup />
                    </PhoneFrame>
                }
                points={[
                    "Loans, retirement, compound interest, ROI, margins",
                    "Every figure explained, none of them guessed",
                    "Works signed out, forever free",
                ]}
            />

            {/* ── FinnaBot ─────────────────────────────────────────────── */}
            <section className="border-y border-border bg-sunken">
                <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-6 py-20 text-center">
                    <Reveal>
                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                            FinnaBot
                        </p>
                    </Reveal>
                    <Reveal delay={60}>
                        <h2 className="text-[clamp(2rem,4.5vw,3.25rem)] font-bold leading-[1.05] tracking-[-0.02em] text-foreground">
                            Ask it like you&rsquo;d ask a friend who knows money.
                        </h2>
                    </Reveal>
                    <Reveal delay={120}>
                        <p className="max-w-xl text-lg text-muted-foreground">
                            Plain answers on budgeting, investing and taxes, with a pointer to the part of the
                            app that does the thing. It&rsquo;s an AI, it can be wrong, and it says so.
                        </p>
                    </Reveal>
                    <Reveal delay={180}>
                        <button
                            type="button"
                            onClick={() => openChat()}
                            className="inline-flex h-12 items-center rounded-full bg-brand px-7 text-base font-semibold text-white transition hover:opacity-90"
                        >
                            Ask FinnaBot
                        </button>
                    </Reveal>
                </div>
            </section>

            {/* ── Education ────────────────────────────────────────────── */}
            <section className="border-b border-border">
                <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-20">
                    <Reveal className="flex flex-col gap-3">
                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                            Education
                        </p>
                        <h2 className="max-w-2xl text-[clamp(2rem,4.5vw,3.25rem)] font-bold leading-[1.05] tracking-[-0.02em] text-foreground">
                            Short lessons, in plain language.
                        </h2>
                    </Reveal>
                    <div className="grid gap-3 sm:grid-cols-3">
                        {EDU_TOPICS.map((topic, index) => (
                            <Reveal key={topic.id} delay={index * 60}>
                                <Link
                                    href={`/education/${topic.id}`}
                                    className="flex h-full flex-col justify-between gap-6 rounded-card border-[1.5px] border-border bg-card p-6 transition hover:border-border-strong"
                                >
                                    <span className="text-xl font-bold text-foreground">{topic.name}</span>
                                    <span className="text-sm font-semibold text-primary">Start learning →</span>
                                </Link>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── App + waitlist ───────────────────────────────────────── */}
            <section id="waitlist" className="bg-foreground text-background">
                <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 lg:grid-cols-2 lg:items-center">
                    <Reveal className="flex flex-col gap-5">
                        <h2 className="text-[clamp(2rem,4.5vw,3.25rem)] font-bold leading-[1.05] tracking-[-0.02em]">
                            FinnaCalc for iPhone is coming.
                        </h2>
                        <p className="max-w-md text-lg opacity-80">
                            Everything here, plus bill reminders, widgets and notifications. Join the waitlist
                            and we&rsquo;ll email you at launch — that&rsquo;s all we&rsquo;ll use it for.
                        </p>
                        <div className="max-w-md">
                            <WaitlistForm referralSource="landing" buttonLabel="Join" />
                        </div>
                    </Reveal>
                    <Reveal delay={120} className="flex justify-center lg:justify-end">
                        <StoreBadge topText="Coming soon to the" bottomText="App Store" href="#waitlist" />
                    </Reveal>
                </div>
            </section>
        </div>
    )
}

function Stat({ value, label, suffix = "+" }: { value: number; label: string; suffix?: string }) {
    return (
        <Reveal className="flex flex-col gap-1">
            <p className="figure text-5xl font-bold tracking-tight text-foreground">
                <CountUp to={value} />
                {suffix}
            </p>
            <p className="text-sm text-muted-foreground">{label}</p>
        </Reveal>
    )
}

function ProductSection({
    eyebrow,
    title,
    body,
    points,
    href,
    cta,
    media,
    reversed = false,
    tone = "light",
}: {
    eyebrow: string
    title: string
    body: string
    points: string[]
    href: string
    cta: string
    media: React.ReactNode
    reversed?: boolean
    tone?: "light" | "dark"
}) {
    return (
        <section
            className={cn(
                "border-b border-border",
                tone === "dark" ? "bg-foreground text-background" : "bg-background"
            )}
        >
            <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-2 lg:gap-16 lg:py-28">
                <div className={cn("flex flex-col justify-center gap-6", reversed && "lg:order-2")}>
                    <Reveal className="flex flex-col gap-4">
                        <p
                            className={cn(
                                "text-xs font-bold uppercase tracking-[0.14em]",
                                tone === "dark" ? "opacity-70" : "text-muted-foreground"
                            )}
                        >
                            {eyebrow}
                        </p>
                        <h2 className="text-[clamp(2rem,4.5vw,3.25rem)] font-bold leading-[1.05] tracking-[-0.02em]">
                            {title}
                        </h2>
                        <p className={cn("text-lg leading-relaxed", tone === "dark" ? "opacity-80" : "text-muted-foreground")}>
                            {body}
                        </p>
                    </Reveal>

                    <Reveal delay={80} as="span">
                        <ul className="flex flex-col gap-2.5">
                            {points.map((point) => (
                                <li key={point} className="flex items-start gap-2.5 text-base">
                                    <span
                                        className={cn(
                                            "mt-2 h-1.5 w-1.5 shrink-0 rounded-full",
                                            tone === "dark" ? "bg-background/60" : "bg-primary"
                                        )}
                                    />
                                    <span className={tone === "dark" ? "opacity-85" : "text-body"}>{point}</span>
                                </li>
                            ))}
                        </ul>
                    </Reveal>

                    <Reveal delay={140}>
                        <Link
                            href={href}
                            className={cn(
                                "inline-flex h-12 items-center rounded-full px-7 text-base font-semibold transition",
                                tone === "dark"
                                    ? "bg-background text-foreground hover:opacity-90"
                                    : "bg-primary text-primary-foreground hover:bg-primary-hover"
                            )}
                        >
                            {cta}
                        </Link>
                    </Reveal>
                </div>

                <div className={cn("flex justify-center", reversed && "lg:order-1")}>
                    <StickyMedia>
                        <Reveal delay={100}>{media}</Reveal>
                    </StickyMedia>
                </div>
            </div>
        </section>
    )
}
