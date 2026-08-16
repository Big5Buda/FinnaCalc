import type { Metadata } from "next"
import Link from "next/link"
import { ArrowUpRight, ShieldCheck } from "lucide-react"
import { SAFE_INVESTMENTS } from "@/lib/investing/catalog"
import { Notice } from "@/components/ui/primitives"

export const metadata: Metadata = {
    title: "Safe investment options",
    description: "A reference list of lower-risk options, with their typical return and risk level.",
}

/**
 * A static reference list, ported from SafeInvestmentsView.swift. It drives no
 * calculation and recommends nothing — the returns quoted are historical
 * averages published by the providers, not a forecast.
 */
export default function SafeInvestmentsPage() {
    return (
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-5 py-6">
            <Link href="/investing" className="text-sm font-semibold text-primary">
                ← Investing
            </Link>

            <header className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Safe Investment Options</h1>
                <p className="text-sm text-muted-foreground">
                    Top safest investments with consistent returns
                </p>
            </header>

            <Notice tone="caution">
                <span className="flex items-start gap-2">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                        Educational only, not financial advice. &ldquo;Safe&rdquo; means lower risk, never no
                        risk: every investment here can lose value, and the returns shown are past averages
                        rather than a promise. Only the savings account is FDIC insured.
                    </span>
                </span>
            </Notice>

            <ul className="overflow-hidden rounded-xl border border-border bg-card">
                {SAFE_INVESTMENTS.map((investment, index) => (
                    <li
                        key={investment.symbol}
                        className={index > 0 ? "border-t border-border p-4" : "p-4"}
                    >
                        <div className="flex items-start gap-3">
                            <div className="flex min-w-0 flex-1 flex-col gap-1">
                                <p className="text-sm font-semibold text-foreground">{investment.name}</p>
                                <p className="text-xs text-muted-foreground">{investment.description}</p>
                                <p className="figure text-[11px] font-normal text-muted-foreground">
                                    Avg return {investment.avgReturn} · Risk {investment.risk} · Min{" "}
                                    {investment.minInvestment}
                                </p>
                            </div>
                            <a
                                href={investment.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-primary"
                            >
                                Learn more
                                <ArrowUpRight className="h-3 w-3" />
                            </a>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    )
}
