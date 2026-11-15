import { manualPortfolioAnalysis, type ManualHolding } from "./manual-portfolio"
import { holdingSector, researchEntry } from "./investing/research-catalog"

export function portfolioInsights(holdings: ManualHolding[]) {
    const report = manualPortfolioAnalysis(holdings)
    const rows = report.rows.map(row => ({ ...row, name: researchEntry(row.symbol)?.name ?? row.symbol,
        gainPercent: row.gain === null || row.cost === 0 ? null : row.gain / row.cost * 100 }))
    const groups = new Map<string, { id: string; name: string; color: string; amount: number }>()
    for (const allocation of report.allocations) {
        const sector = holdingSector(allocation.symbol)
        const previous = groups.get(sector.id)
        groups.set(sector.id, { id: sector.id, name: sector.name, color: sector.color, amount: (previous?.amount ?? 0) + allocation.amount })
    }
    const total = report.allocations.reduce((sum, row) => sum + row.amount, 0)
    const sectors = [...groups.values()].map(sector => ({ ...sector, weight: total > 0 ? sector.amount / total * 100 : null })).sort((a, b) => b.amount - a.amount)
    const winners = rows.filter(row => row.gain !== null && row.gain > 0).length
    const losers = rows.filter(row => row.gain !== null && row.gain < 0).length
    const topThreeWeight = total > 0 ? report.allocations.slice(0, 3).reduce((sum, row) => sum + (row.weight ?? 0), 0) : null
    const dates = rows.flatMap(row => row.priceAsOf ? [row.priceAsOf] : []).sort()
    return { ...report, rows, sectors, winners, losers, topThreeWeight, oldestPrice: dates.at(0) ?? null, newestPrice: dates.at(-1) ?? null }
}
