"use client"

import Link from "next/link"
import { DM_Sans, Source_Serif_4 } from "next/font/google"
import { useEffect, useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { useReducedMotion } from "@/components/motion/motion"

/**
 * The standalone auth layout, in the marketing site's warm-light system.
 *
 * These two screens are the doorway between the marketing site and the app,
 * and at the user's direction they dress like the side they're entered from:
 * cream ground, warm black, pill buttons, the serif carrying the brand line.
 * The rest of the app keeps its Paper & Cobalt tokens for iOS parity — this
 * is a deliberate island, which is why the palette is written in literal hex
 * here instead of the app's tokens: nothing else in this workspace should be
 * able to inherit it by accident.
 *
 * The proof points rotate. They're facts about what the product does, not
 * marketing claims we'd have to stand behind with numbers; each one is
 * something the site demonstrably does.
 */

const serif = Source_Serif_4({ subsets: ["latin"], weight: "variable", variable: "--auth-serif" })
const sans = DM_Sans({ subsets: ["latin"], weight: "variable", variable: "--auth-sans" })

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
        <div
            className={cn(
                serif.variable,
                sans.variable,
                "flex min-h-screen flex-col font-[family-name:var(--auth-sans)] lg:flex-row"
            )}
        >
            {/* Left: the brand moment — the marketing hero's warm gradient,
                the serif speaking, the coin mark. */}
            <section
                className="relative flex flex-col justify-between gap-10 px-8 py-10 text-[#FCFCFC] lg:w-[46%] lg:px-14 lg:py-14"
                style={{
                    background:
                        "radial-gradient(120% 90% at 80% 100%, rgb(161 116 92 / 0.55), transparent 60%)," +
                        "radial-gradient(100% 80% at 15% 10%, rgb(143 133 120 / 0.9), transparent 70%)," +
                        "linear-gradient(135deg, #8f8578 0%, #857466 45%, #93705c 100%)",
                }}
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
                                    "absolute inset-0 text-lg leading-relaxed text-[#FCFCFC]/85 transition-opacity duration-700 motion-reduce:transition-none",
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

                <p className="text-xs text-[#FCFCFC]/60">
                    FinnaCalc is a tool, not an advisor. Nothing here is financial advice.
                </p>
            </section>

            {/* Right: the card on cream, and the strip under it. */}
            <section className="flex flex-1 flex-col bg-[#F5F3EF]">
                <div className="flex flex-1 items-center justify-center px-5 py-12">
                    <div className="w-full max-w-md rounded-[24px] border border-[#E4E2E1] bg-[#FCFCFC] p-7 shadow-[0_1px_2px_rgb(28_27_27/0.04)] sm:p-9">
                        {children}
                    </div>
                </div>

                <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E4E2E1] px-6 py-5 text-sm">
                    <div className="flex gap-4">
                        <Link
                            href="/privacy"
                            className="font-medium text-[#1C1B1B] underline-offset-4 hover:underline"
                        >
                            Privacy
                        </Link>
                        <Link
                            href="/terms"
                            className="font-medium text-[#1C1B1B] underline-offset-4 hover:underline"
                        >
                            Terms
                        </Link>
                    </div>
                    <p className="text-[#686664]">
                        Coming to iPhone —{" "}
                        <Link
                            href="/#waitlist"
                            className="font-medium text-[#1C1B1B] underline-offset-4 hover:underline"
                        >
                            join the waitlist
                        </Link>
                    </p>
                </footer>
            </section>
        </div>
    )
}
