import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { CALCULATORS, calculatorBySlug, type CalculatorSlug } from "@/lib/calculators/catalog"
import { CalculatorBySlug } from "@/components/calculators/screens"

export function generateStaticParams() {
    return CALCULATORS.map((entry) => ({ slug: entry.slug }))
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string }>
}): Promise<Metadata> {
    const { slug } = await params
    const entry = calculatorBySlug(slug)
    if (!entry) return {}
    return { title: entry.title, description: entry.summary }
}

export default async function CalculatorPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params
    const entry = calculatorBySlug(slug)
    if (!entry) notFound()
    return <CalculatorBySlug slug={entry.slug as CalculatorSlug} />
}
