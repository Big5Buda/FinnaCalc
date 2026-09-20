import type { Metadata } from "next"
import Link from "next/link"
import * as Icons from "lucide-react"
import { CALCULATORS } from "@/lib/calculators/catalog"

export const metadata: Metadata = {
    title: "FinnaCalc: Financial Calculators and Personal Finance Tools",
    description:
        "Free financial calculators and personal finance tools: budgeting, investing, a federal tax estimator, and lessons that explain the numbers.",
}

/**
 * Home, the way it was: a headline, the calculators, why FinnaCalc, and a
 * footer. The dashboard that replaced it assumed you were signed in and had
 * figures to show; this page assumes nothing and works for anyone who
 * arrives.
 *
 * The calculators come from the shared catalog, which is ported from the iOS
 * app's, so the grid here is the app's list: same titles, same summaries,
 * same order, same icons. The old page kept its own copy of that list and it
 * drifted.
 *
 * Laid out for a phone this time. The old grid was three columns at every
 * width, which is what the owner's screenshot of it on a phone shows.
 */
export default function HomePage() {
    return (
        <div className="flex flex-col">
            <section className="bg-gradient-to-br from-primary/[0.06] to-background py-16 sm:py-20">
                <div className="mx-auto max-w-7xl px-6 text-center">
                    <h1 className="text-4xl font-bold leading-tight text-foreground sm:text-5xl">
                        Professional <span className="text-primary">Financial Calculators</span> and{" "}
                        <span className="text-primary">Personal Finance</span> Tools
                    </h1>
                    <p className="mx-auto mt-6 max-w-3xl text-lg text-muted-foreground sm:text-xl">
                        Free calculators, a budget that can follow your bank, investing research, a federal
                        tax estimator, and short lessons on money. Built for individuals, small business
                        owners and entrepreneurs, with the math shown.
                    </p>
                </div>
            </section>

            <section id="calculators" className="bg-secondary/40 py-16">
                <div className="mx-auto max-w-7xl px-6">
                    <div className="mb-12 text-center">
                        <h2 className="mb-4 text-3xl font-bold text-foreground">Choose Your Calculator</h2>
                        <p className="text-lg text-muted-foreground">
                            Professional financial tools to help you make better decisions
                        </p>
                    </div>
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {CALCULATORS.map((entry) => {
                            const Icon =
                                (Icons as unknown as Record<string, Icons.LucideIcon>)[entry.icon] ?? Icons.Calculator
                            return (
                                <Link
                                    key={entry.slug}
                                    href={`/calculators/${entry.slug}`}
                                    className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
                                >
                                    <div className="flex items-start gap-3">
                                        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
                                            <Icon className="h-5 w-5" strokeWidth={2.2} aria-hidden="true" />
                                        </span>
                                        <span className="flex min-w-0 flex-col gap-0.5">
                                            <span className="text-base font-semibold leading-tight text-foreground">
                                                {entry.title}
                                            </span>
                                            <span className="text-sm font-medium text-primary">{entry.category}</span>
                                        </span>
                                    </div>
                                    <p className="text-sm leading-relaxed text-muted-foreground">{entry.summary}</p>
                                </Link>
                            )
                        })}
                    </div>
                </div>
            </section>

            <section className="py-16">
                <div className="mx-auto max-w-7xl px-6">
                    <h2 className="mb-12 text-center text-3xl font-bold text-foreground">Why Choose FinnaCalc?</h2>
                    <div className="grid gap-8 sm:grid-cols-3">
                        {[
                            {
                                title: "The calculators are free",
                                desc: "Every calculator on this page works without an account and without a plan.",
                            },
                            {
                                title: "Real numbers",
                                desc: "Figures come from what you enter and from public data. Nothing is invented to fill a space.",
                            },
                            {
                                title: "FinnaBot",
                                desc: "An AI helper in the corner of every page that answers money questions in plain words.",
                            },
                        ].map((feature) => (
                            <div key={feature.title} className="flex items-start gap-3">
                                <span className="mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-sm text-white">
                                    ✓
                                </span>
                                <div>
                                    <h3 className="font-semibold text-foreground">{feature.title}</h3>
                                    <p className="text-muted-foreground">{feature.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="bg-primary py-16">
                <div className="mx-auto max-w-7xl px-6 text-center">
                    <h2 className="mb-4 text-3xl font-bold text-white">Ready to take control of your finances?</h2>
                    <p className="mb-8 text-lg text-white/80">
                        Start with a calculator, or sign up to keep a budget, follow your portfolio and estimate your taxes.
                    </p>
                    <div className="flex flex-wrap justify-center gap-3">
                        <Link
                            href="#calculators"
                            className="inline-flex h-12 items-center rounded-full bg-white px-7 font-semibold text-primary transition hover:bg-white/90"
                        >
                            Explore the calculators
                        </Link>
                        <Link
                            href="/sign-up"
                            className="inline-flex h-12 items-center rounded-full border border-white/60 px-7 font-semibold text-white transition hover:bg-white/10"
                        >
                            Create a free account
                        </Link>
                    </div>
                </div>
            </section>
        </div>
    )
}
