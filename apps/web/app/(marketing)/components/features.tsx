"use client"

import { useRef, type MouseEvent, type ReactNode } from "react"
import { BookOpen, Landmark, LineChart, PieChart } from "lucide-react"
import { CALCULATORS } from "@finnacalc/shared/calculators-catalog"
import { Rise, Stagger } from "@/components/motion"
import { appUrl } from "@/lib/app-url"
import { cn } from "@/lib/utils"

/**
 * The feature overview, as a bento rather than a row of matching cards.
 *
 * The sizes carry meaning: calculation is the thing this product is, so it gets
 * the double cell, and the other three are the places those numbers go. A grid
 * of four identical cards would say all four are equally central, which isn't
 * true of this product.
 *
 * Each card lights its border where the pointer is. The glow is a border
 * effect, not a fill — it marks the edge the cursor is near without washing
 * mint over content, since mint on this site means "this is a real figure".
 */

/** Counted from the catalog, never typed in — the copy can't drift from what ships. */
const CALCULATOR_COUNT = CALCULATORS.length

export function Features() {
    return (
        <section id="features" className="bg-mesh-surface">
            <Stagger className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-24">
                <Rise className="flex max-w-2xl flex-col gap-3">
                    <p className="figure text-xs uppercase tracking-[0.22em] text-mint">The platform</p>
                    <h2 className="font-display text-[clamp(1.85rem,4.4vw,3rem)] leading-[1.04] tracking-[-0.02em] text-ink">
                        <span className="font-black">Model it</span>{" "}
                        <span className="font-extralight">then live with it.</span>
                    </h2>
                    <p className="text-lg font-extralight leading-relaxed text-ink-muted">
                        The calculation is the centre. Everything else is where the answer goes once
                        you&rsquo;ve got it.
                    </p>
                </Rise>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 lg:grid-rows-2">
                    {/* The double cell: calculation is what this product is. */}
                    <SpotlightCard
                        href={appUrl("/calculators")}
                        className="md:col-span-2 lg:col-span-2 lg:row-span-2"
                    >
                        <div className="flex h-full flex-col">
                            <CardIcon>
                                <PieChart className="h-5 w-5" />
                            </CardIcon>

                            <h3 className="pt-5 font-display text-2xl font-black text-ink">
                                The calculation engine
                            </h3>
                            <p className="max-w-md pt-2 text-base font-extralight leading-relaxed text-ink-muted">
                                Loans, retirement, compound growth, emergency runway, break-even, ROI,
                                margins. Every figure shows the arithmetic behind it, and a value nobody can
                                compute renders as a dash rather than a guess.
                            </p>

                            {/* Inputs above the rule, outputs below it: the real
                                hierarchy of a model, not a decorative divider. */}
                            <div className="divider-fade my-6" aria-hidden="true" />

                            <dl className="mt-auto grid grid-cols-3 gap-4">
                                <Metric value={String(CALCULATOR_COUNT)} label="calculators" />
                                <Metric value="1040" label="tax engine, tested" />
                                <Metric value="10yr" label="SEC filings per company" />
                            </dl>
                        </div>
                    </SpotlightCard>

                    <SpotlightCard href={appUrl("/budgeting")}>
                        <CardIcon>
                            <Landmark className="h-5 w-5" />
                        </CardIcon>
                        <h3 className="pt-4 font-display text-xl font-black text-ink">Budgeting</h3>
                        <p className="pt-2 text-sm font-extralight leading-relaxed text-ink-muted">
                            Connect a bank through Plaid or type it by hand. Category caps, goals, recurring
                            charges. Stored on your device, not our servers.
                        </p>
                    </SpotlightCard>

                    <SpotlightCard href={appUrl("/investing")}>
                        <CardIcon>
                            <LineChart className="h-5 w-5" />
                        </CardIcon>
                        <h3 className="pt-4 font-display text-xl font-black text-ink">Investing</h3>
                        <p className="pt-2 text-sm font-extralight leading-relaxed text-ink-muted">
                            Live quotes, your real holdings, cost basis. Orders execute at your own brokerage
                            — FinnaCalc never holds your money.
                        </p>
                    </SpotlightCard>

                    <SpotlightCard href={appUrl("/education")} className="md:col-span-2 lg:col-span-1">
                        <CardIcon>
                            <BookOpen className="h-5 w-5" />
                        </CardIcon>
                        <h3 className="pt-4 font-display text-xl font-black text-ink">Education</h3>
                        <p className="pt-2 text-sm font-extralight leading-relaxed text-ink-muted">
                            Short lessons on credit, investing, retirement and tax, in plain language.
                        </p>
                    </SpotlightCard>
                </div>
            </Stagger>
        </section>
    )
}

/**
 * A card whose border lights where the pointer is.
 *
 * Position is written to CSS custom properties on pointer move rather than to
 * React state: this fires on every mouse event, and re-rendering four cards at
 * that rate for a lighting effect would cost more than the effect is worth.
 */
function SpotlightCard({
    href,
    className,
    children,
}: {
    href: string
    className?: string
    children: ReactNode
}) {
    const ref = useRef<HTMLAnchorElement>(null)

    function onMouseMove(event: MouseEvent<HTMLAnchorElement>) {
        const node = ref.current
        if (!node) return
        const rect = node.getBoundingClientRect()
        node.style.setProperty("--spot-x", `${event.clientX - rect.left}px`)
        node.style.setProperty("--spot-y", `${event.clientY - rect.top}px`)
    }

    return (
        <a
            ref={ref}
            href={href}
            onMouseMove={onMouseMove}
            className={cn(
                "group relative flex flex-col overflow-hidden rounded-2xl border border-white/10",
                "bg-surface-elevated/40 p-6 backdrop-blur-md transition-colors duration-300",
                "hover:border-mint/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint",
                className
            )}
        >
            {/* The lit edge. Masked to the border box so mint traces the outline
                instead of washing across the text. */}
            <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{
                    background:
                        "radial-gradient(220px circle at var(--spot-x, 50%) var(--spot-y, 0px), rgb(var(--accent-mint) / 0.55), transparent 70%)",
                    padding: "1px",
                    WebkitMask:
                        "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
                    WebkitMaskComposite: "xor",
                    maskComposite: "exclude",
                }}
            />
            {/* A far dimmer wash inside, so the card feels lit rather than outlined. */}
            <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{
                    background:
                        "radial-gradient(240px circle at var(--spot-x, 50%) var(--spot-y, 0px), rgb(var(--accent-mint) / 0.05), transparent 70%)",
                }}
            />
            <span className="relative flex h-full flex-col">{children}</span>
        </a>
    )
}

function CardIcon({ children }: { children: ReactNode }) {
    return (
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-mint/12 text-mint">
            {children}
        </span>
    )
}

function Metric({ value, label }: { value: string; label: string }) {
    return (
        <div className="flex flex-col gap-1">
            <dt className="sr-only">{label}</dt>
            <dd className="figure text-2xl font-black text-ink">{value}</dd>
            <p className="text-[11px] font-light leading-tight text-ink-muted">{label}</p>
        </div>
    )
}
