"use client"

import Link from "next/link"
import { useEffect, useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { useReducedMotion } from "@/components/motion/motion"
import { Wordmark } from "@/components/shell/wordmark"

/**
 * The standalone auth layout: a deep brand panel carrying the wordmark and the
 * pitch on the left, the form card on the right, and a thin strip along the
 * bottom. No site nav — the form is the only thing to do on this page.
 *
 * The proof points rotate. They're facts about what the product does, not
 * marketing claims we'd have to stand behind with numbers; each one is
 * something the site demonstrably does.
 */
const PROOF_POINTS = [
    "Eleven calculators, free, with nothing to sign up for.",
    "Your budget, goals and history stay on your device.",
    "Orders execute at your own brokerage, never here.",
    "Ten years of company filings, straight from the SEC.",
]

export function AuthSplit({ children }: { children: ReactNode }) {
    const reduced = useReducedMotion()
    const [index, setIndex] = useState(0)

    useEffect(() => {
        if (reduced) return
        const timer = setInterval(() => setIndex((current) => (current + 1) % PROOF_POINTS.length), 4200)
        return () => clearInterval(timer)
    }, [reduced])

    return (
        <div className="flex min-h-screen flex-col lg:flex-row">
            {/* Left: the pitch. Deep brand blue, white type, no chrome. */}
            <section className="relative flex flex-col justify-between gap-10 bg-primary px-8 py-10 text-white lg:w-[46%] lg:px-14 lg:py-14">
                <Link href="/" aria-label="FinnaCalc home">
                    <Wordmark className="text-2xl text-white [&>span]:text-white/70" />
                </Link>

                <div className="flex max-w-md flex-col gap-6">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/70">
                        Your money, all of it
                    </p>
                    <h1 className="text-[clamp(2.25rem,4.6vw,3.5rem)] font-bold leading-[1.02] tracking-[-0.03em]">
                        Your whole financial life, in one place.
                    </h1>

                    {/* One line at a time, cross-fading. Under reduced motion the
                        first line simply stays put. */}
                    <div className="relative h-16">
                        {PROOF_POINTS.map((point, position) => (
                            <p
                                key={point}
                                className={cn(
                                    "absolute inset-0 text-lg leading-relaxed text-white/85 transition-opacity duration-700 motion-reduce:transition-none",
                                    reduced
                                        ? position === 0
                                            ? "opacity-100"
                                            : "opacity-0"
                                        : position === index
                                          ? "opacity-100"
                                          : "opacity-0"
                                )}
                                aria-hidden={position === index ? undefined : true}
                            >
                                {point}
                            </p>
                        ))}
                    </div>
                </div>

                <p className="text-xs text-white/60">
                    FinnaCalc is a tool, not an advisor. Nothing here is financial advice.
                </p>
            </section>

            {/* Right: the card, and the strip under it. */}
            <section className="flex flex-1 flex-col bg-sunken">
                <div className="flex flex-1 items-center justify-center px-5 py-12">
                    <div className="w-full max-w-md rounded-2xl border border-border bg-card p-7 shadow-sm sm:p-9">
                        {children}
                    </div>
                </div>

                <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-5 text-sm">
                    <div className="flex gap-4">
                        <Link href="/privacy" className="font-semibold text-foreground underline-offset-4 hover:underline">
                            Privacy
                        </Link>
                        <Link href="/terms" className="font-semibold text-foreground underline-offset-4 hover:underline">
                            Terms
                        </Link>
                    </div>
                    <p className="text-muted-foreground">
                        Coming to iPhone —{" "}
                        <Link href="/#waitlist" className="font-semibold text-foreground underline-offset-4 hover:underline">
                            join the waitlist
                        </Link>
                    </p>
                </footer>
            </section>
        </div>
    )
}
