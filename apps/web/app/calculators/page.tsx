import type { Metadata } from "next"
import Link from "next/link"
import * as Icons from "lucide-react"
import { CALCULATORS } from "@finnacalc/shared/calculators-catalog"

export const metadata: Metadata = {
    title: "Calculators",
    description: `${CALCULATORS.length} free financial calculators — loans, retirement, compound interest, break-even and more. No account needed; every one shows its work.`,
}

/**
 * The calculator directory. Every entry is a fully working tool on its own
 * page — the real shared engine, un-gated. This list is generated from the
 * same catalog the app ships, so it can't promise a calculator that doesn't
 * exist.
 */
export default function CalculatorsIndex() {
    const categories = [...new Set(CALCULATORS.map((entry) => entry.category))]

    return (
        <main className="bg-paper pt-[92px]">
            <div className="mx-auto flex max-w-site flex-col gap-12 px-6 pb-24 pt-16">
                <header className="flex max-w-2xl flex-col gap-4">
                    <h1 className="headline-sans text-[clamp(2.25rem,4.2vw,3.5rem)] text-ink">
                        {CALCULATORS.length} calculators. Every one shows its work.
                    </h1>
                    <p className="text-xl leading-relaxed text-ink-soft">
                        All free, none need an account, and each runs the same engine the app uses —
                        so the number you get here is the number you&rsquo;d get there.
                    </p>
                </header>

                {categories.map((category) => (
                    <section key={category} className="flex flex-col gap-4">
                        <h2 className="text-sm font-medium uppercase tracking-[0.08em] text-ink-muted">
                            {category}
                        </h2>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {CALCULATORS.filter((entry) => entry.category === category).map(
                                (entry) => {
                                    const Icon =
                                        (Icons as unknown as Record<string, Icons.LucideIcon>)[
                                            entry.icon
                                        ] ?? Icons.Calculator
                                    return (
                                        <Link
                                            key={entry.slug}
                                            href={`/calculators/${entry.slug}`}
                                            className="flex flex-col gap-3 rounded-lg border border-line bg-chip p-6 transition-colors duration-[350ms] ease-ws hover:border-line-strong"
                                        >
                                            <Icon
                                                className="h-6 w-6 text-ink"
                                                strokeWidth={1.75}
                                                aria-hidden="true"
                                            />
                                            <span className="headline-sans text-lg text-ink">
                                                {entry.shortTitle}
                                            </span>
                                            <span className="text-sm leading-relaxed text-ink-soft">
                                                {entry.summary}
                                            </span>
                                        </Link>
                                    )
                                }
                            )}
                        </div>
                    </section>
                ))}
            </div>
        </main>
    )
}
