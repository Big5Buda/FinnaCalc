import { redirect } from "next/navigation"
import { researchSymbol } from "@/lib/manual-portfolio"
import { researchHref } from "@/lib/tradingview"

export default async function WidgetResearch({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    const query = await searchParams
    const value = query.tvwidgetsymbol ?? query.symbol
    const symbol = typeof value === "string" ? researchSymbol(value) : null
    redirect(symbol ? researchHref(symbol) : "/investing")
}
