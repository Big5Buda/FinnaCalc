"use client"

import { m, useReducedMotion } from "framer-motion"
import { compoundInterestSeries } from "@finnacalc/shared/calculators"
import { compactMoney } from "@finnacalc/shared/format"
import { signUpUrl } from "@/lib/app-url"
import { Pill } from "@/components/site"

/**
 * The hero, composed the way the reference composes it: a warm gradient
 * ground, a hand-drawn white line climbing across it, small rounded tiles of
 * the product floating along the curve, and the headline — serif, centred,
 * small against all that space — near the bottom.
 *
 * The reference fills this frame with a video montage. Until FinnaCalc has one
 * (the user intends to shoot it), the ground is the gradient and the tiles are
 * live product vignettes instead of film clips — which has one honest
 * advantage: the figure on the compound tile is computed by the same shared
 * engine the app runs, not filmed.
 *
 * The line draws itself once on load (pathLength), the tiles rise with it, and
 * prefers-reduced-motion renders everything settled immediately.
 */

/** One worked example, stated and computed — never a number pulled from air. */
const EXAMPLE = { monthly: 400, rate: 7, years: 25 }
const exampleSeries = compoundInterestSeries({
    initialDeposit: 0,
    monthlyContribution: EXAMPLE.monthly,
    annualRate: EXAMPLE.rate,
    years: EXAMPLE.years,
})
const exampleResult = exampleSeries[exampleSeries.length - 1]

/** Rises, dips, recovers — a market line, not a slogan line. */
const LINE_PATH =
    "M -20 560 C 180 480, 300 430, 420 360 C 500 313, 540 320, 570 380 C 590 420, 610 430, 640 400 C 720 320, 860 220, 1010 150 C 1100 108, 1180 80, 1280 60"

export function Hero() {
    const reduceMotion = useReducedMotion()

    return (
        <section className="hero-ground relative overflow-hidden pt-[92px]">
            <div className="relative mx-auto flex min-h-[88vh] max-w-site flex-col px-6">
                {/* ── The line and its tiles ────────────────────────────── */}
                <div className="relative h-[46vh] min-h-[320px] flex-1">
                    <svg
                        viewBox="0 0 1264 600"
                        preserveAspectRatio="xMidYMid slice"
                        className="absolute inset-0 h-full w-full"
                        aria-hidden="true"
                    >
                        <m.path
                            d={LINE_PATH}
                            fill="none"
                            stroke="#FCFCFC"
                            strokeWidth={2.5}
                            strokeLinecap="round"
                            initial={reduceMotion ? false : { pathLength: 0 }}
                            animate={{ pathLength: 1 }}
                            transition={{ duration: 2.2, ease: [0.241, 0.969, 0.635, 0.997] }}
                        />
                    </svg>

                    <Tile className="left-[8%] top-[42%] hidden w-44 sm:block" delay={0.7}>
                        <p className="text-[11px] text-ink-muted">Where the month went</p>
                        <div className="flex flex-col gap-1.5 pt-2">
                            <CategoryBar label="Rent" width="82%" />
                            <CategoryBar label="Groceries" width="55%" />
                            <CategoryBar label="Saving" width="38%" grow />
                        </div>
                    </Tile>

                    <Tile className="left-[34%] top-[18%] w-52" delay={1.1}>
                        <p className="text-[11px] text-ink-muted">
                            ${EXAMPLE.monthly}/mo at {EXAMPLE.rate}% for {EXAMPLE.years} years
                        </p>
                        <p className="figure pt-1 text-2xl font-semibold text-ink">
                            {compactMoney(exampleResult.balance)}
                        </p>
                        <p className="text-[11px] text-celery">
                            {compactMoney(exampleResult.growth)} of that is growth
                        </p>
                    </Tile>

                    <Tile className="right-[10%] top-[8%] hidden w-40 lg:block" delay={1.5}>
                        <p className="text-[11px] text-ink-muted">Watchlist</p>
                        <svg viewBox="0 0 130 36" className="mt-2 w-full" aria-hidden="true">
                            <path
                                d="M0 30 C 18 26, 28 18, 44 20 C 60 22, 68 10, 84 12 C 100 14, 112 6, 130 4"
                                fill="none"
                                stroke="rgb(72 102 53)"
                                strokeWidth={2}
                            />
                        </svg>
                        <div className="flex gap-1.5 pt-2">
                            {["AAPL", "VOO", "MSFT"].map((symbol) => (
                                <span
                                    key={symbol}
                                    className="figure rounded-pill bg-ink/5 px-2 py-0.5 text-[10px] font-medium text-ink-soft"
                                >
                                    {symbol}
                                </span>
                            ))}
                        </div>
                    </Tile>
                </div>

                {/* ── The claim ─────────────────────────────────────────── */}
                <div className="flex flex-col items-center gap-5 pb-24 text-center">
                    <m.h1
                        initial={reduceMotion ? false : { opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
                        className="headline-serif text-[clamp(2.75rem,5.5vw,4rem)] text-chip"
                    >
                        Do the math.
                    </m.h1>
                    <m.p
                        initial={reduceMotion ? false : { opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 1, ease: "easeOut", delay: 0.35 }}
                        className="max-w-xl text-xl text-chip/90"
                    >
                        Your budget, your investments, your tax bill. You can always check how we got the number.
                    </m.p>
                    <m.div
                        initial={reduceMotion ? false : { opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 1, ease: "easeOut", delay: 0.5 }}
                    >
                        <Pill href={signUpUrl()} tone="outline-on-color" className="px-7">
                            Get started
                        </Pill>
                    </m.div>
                </div>
            </div>
        </section>
    )
}

function Tile({
    className,
    delay,
    children,
}: {
    className?: string
    delay: number
    children: React.ReactNode
}) {
    const reduceMotion = useReducedMotion()
    return (
        <m.div
            initial={reduceMotion ? false : { opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: "easeOut", delay: reduceMotion ? 0 : delay }}
            className={`absolute rounded-lg bg-chip/95 p-3.5 shadow-[0_12px_40px_rgb(28_27_27/0.18)] ${className ?? ""}`}
        >
            {children}
        </m.div>
    )
}

/** A cap bar with no dollar figure — the shape of a budget, not a fake one. */
function CategoryBar({ label, width, grow = false }: { label: string; width: string; grow?: boolean }) {
    return (
        <div className="flex items-center gap-2">
            <span className="w-16 text-[10px] text-ink-soft">{label}</span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-pill bg-ink/8">
                <span
                    className={`block h-full rounded-pill ${grow ? "bg-celery" : "bg-ink/35"}`}
                    style={{ width }}
                />
            </span>
        </div>
    )
}
