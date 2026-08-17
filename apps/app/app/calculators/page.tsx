import type { Metadata } from "next"
import Link from "next/link"
import * as Icons from "lucide-react"
import { ChevronRight } from "lucide-react"
import { PageHeader } from "@/components/shell/page-header"
import { CALCULATORS } from "@/lib/calculators/catalog"

export const metadata: Metadata = {
    title: "All calculators",
    description:
        "Every FinnaCalc calculator: emergency fund, loans, retirement, compound interest, break-even, startup costs, cash flow, pricing, ROI, profit margin, and employee vs contractor.",
}

/** The full calculator directory — the web twin of CalculatorListView. */
export default function CalculatorsPage() {
    return (
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-10">
            <PageHeader
                eyebrow="Calculators"
                title="Run the numbers."
                lead={`${CALCULATORS.length} free tools. Nothing to sign up for, and nothing leaves your browser.`}
            />

            {/* The calculators below each answer one question. This one holds a
                whole model open, so it sits above the list rather than in it. */}
            <Link
                href="/calculator"
                className="flex items-center gap-3.5 rounded-lg border border-border bg-primary/[0.06] p-4 transition hover:border-primary"
            >
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
                    <Icons.SlidersHorizontal className="h-4 w-4" strokeWidth={2.2} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-base font-semibold text-foreground">
                        Modelling workspace
                    </span>
                    <span className="text-xs text-muted-foreground">
                        Contributions, inflation and tax in one live model, with the year-by-year
                        working and a CSV export.
                    </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>

            <div className="flex flex-col gap-2.5">
                {CALCULATORS.map((entry) => {
                    const Icon =
                        (Icons as unknown as Record<string, Icons.LucideIcon>)[entry.icon] ?? Icons.Calculator
                    return (
                        <Link
                            key={entry.slug}
                            href={`/calculators/${entry.slug}`}
                            className="flex items-center gap-3.5 rounded-lg border border-border bg-card p-4 transition hover:border-border-strong"
                        >
                            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
                                <Icon className="h-4 w-4" strokeWidth={2.2} />
                            </span>
                            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                <span className="text-base font-semibold text-foreground">
                                    {entry.shortTitle}
                                </span>
                                <span className="text-xs text-muted-foreground">{entry.summary}</span>
                            </span>
                            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                        </Link>
                    )
                })}
            </div>
        </div>
    )
}
