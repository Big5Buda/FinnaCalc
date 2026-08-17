import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import {
    CALCULATORS,
    type CalculatorSlug,
} from "@finnacalc/shared/calculators-catalog"
import { CalculatorRunner } from "@/components/calculator-runner"

export function generateStaticParams() {
    return CALCULATORS.map((entry) => ({ slug: entry.slug }))
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string }>
}): Promise<Metadata> {
    const { slug } = await params
    const entry = CALCULATORS.find((candidate) => candidate.slug === slug)
    if (!entry) return {}
    return { title: entry.title, description: entry.summary }
}

/**
 * One calculator, fully working, no account. The tool is the page — a header,
 * the live form, and the rest of the family below it.
 */
export default async function CalculatorPage({
    params,
}: {
    params: Promise<{ slug: string }>
}) {
    const { slug } = await params
    const entry = CALCULATORS.find((candidate) => candidate.slug === slug)
    if (!entry) notFound()

    const siblings = CALCULATORS.filter(
        (candidate) => candidate.category === entry.category && candidate.slug !== entry.slug
    )

    return (
        <main className="bg-paper pt-[92px]">
            <div className="mx-auto flex max-w-site flex-col gap-10 px-6 pb-24 pt-16">
                <header className="flex max-w-2xl flex-col gap-3">
                    <p className="text-sm font-medium text-ink-muted">
                        <Link href="/calculators" className="hover:underline">
                            Calculators
                        </Link>{" "}
                        · {entry.category}
                    </p>
                    <h1 className="headline-sans text-[clamp(2rem,3.6vw,3rem)] text-ink">
                        {entry.title}
                    </h1>
                    <p className="text-lg leading-relaxed text-ink-soft">{entry.summary}</p>
                </header>

                <CalculatorRunner slug={entry.slug as CalculatorSlug} />

                {siblings.length > 0 && (
                    <div className="flex flex-col gap-4 border-t border-line pt-8">
                        <p className="text-sm font-medium text-ink-muted">
                            More {entry.category.toLowerCase()} calculators
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {siblings.map((sibling) => (
                                <Link
                                    key={sibling.slug}
                                    href={`/calculators/${sibling.slug}`}
                                    className="rounded-pill border border-ink px-4 py-2 text-sm font-medium text-ink transition-colors duration-[350ms] ease-ws hover:bg-ink/5"
                                >
                                    {sibling.shortTitle}
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </main>
    )
}
