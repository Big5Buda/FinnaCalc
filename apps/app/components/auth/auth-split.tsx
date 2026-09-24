"use client"

import Link from "next/link"
import { DM_Sans, Source_Serif_4 } from "next/font/google"
import { useEffect, useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { useReducedMotion } from "@/components/motion/motion"

/**
 * The standalone auth layout: the brand panel on the left, the card on the
 * right.
 *
 * It used to dress in a warm cream-and-brown system of its own, which made
 * the doorway to the app the one screen that did not look like the app. It
 * now takes its colour from the same tokens every other page uses, and the
 * only literal colour left is the white type on the brand panel, which is
 * saturated blue in both light and dark and so cannot take a token that
 * flips with the scheme.
 *
 * The proof points rotate. They are facts about what the product does, not
 * marketing claims we would have to stand behind with numbers; each one is
 * something the site demonstrably does.
 */

const serif = Source_Serif_4({ subsets: ["latin"], weight: "variable", variable: "--auth-serif" })
const sans = DM_Sans({ subsets: ["latin"], weight: "variable", variable: "--auth-sans" })

const PROOF_POINTS = [
    "Eleven calculators, free, with nothing to sign up for.",
    "Your budget, goals and history stay on your device.",
    "Brokerage links are view-only. Trades happen at your broker.",
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
        <div
            className={cn(
                serif.variable,
                sans.variable,
                "flex min-h-screen flex-col font-[family-name:var(--auth-sans)] lg:flex-row"
            )}
        >
            {/* Left: the brand panel, the serif speaking, the coin mark. */}
            <section
                className="auth-ground relative flex flex-col justify-between gap-10 px-6 py-10 text-white sm:px-8 lg:w-[46%] lg:px-14 lg:py-14"
            >
                <Link href="/" aria-label="FinnaCalc home" className="flex items-center gap-2.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/finnacalc-mark.png" alt="" className="h-8 w-auto" />
                    <span className="font-[family-name:var(--auth-serif)] text-[22px] font-semibold tracking-tight">
                        FinnaCalc
                    </span>
                </Link>

                <div className="flex max-w-md flex-col gap-6">
                    <h1 className="font-[family-name:var(--auth-serif)] text-[clamp(2.5rem,4.8vw,3.75rem)] font-normal leading-[1.16] tracking-[-0.01em]">
                        Do the math.
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

                <p className="text-xs text-white/70">
                    FinnaCalc is a tool, not an advisor. Nothing here is financial advice.
                </p>
            </section>

            {/* Right: the card, and the strip under it. */}
            <section className="flex flex-1 flex-col bg-background">
                <div className="flex flex-1 items-center justify-center px-5 py-12">
                    <div className="w-full max-w-md rounded-card border border-border bg-card p-6 shadow-sm sm:p-9">
                        {children}
                    </div>
                </div>

                <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-5 text-sm">
                    <div className="flex gap-4">
                        <Link
                            href="/privacy"
                            className="font-medium text-foreground underline-offset-4 hover:underline"
                        >
                            Privacy
                        </Link>
                        <Link
                            href="/terms"
                            className="font-medium text-foreground underline-offset-4 hover:underline"
                        >
                            Terms
                        </Link>
                    </div>
                    <Link
                        href="/about"
                        className="font-medium text-foreground underline-offset-4 hover:underline"
                    >
                        About FinnaCalc
                    </Link>
                </footer>
            </section>
        </div>
    )
}
