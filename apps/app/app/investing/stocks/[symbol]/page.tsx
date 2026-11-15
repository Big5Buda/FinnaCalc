import type { Metadata } from "next"
import { StockDetailPage } from "@/components/investing/stock-detail"
import { websiteReview } from "@/lib/website-review"
import { PublicStockResearch } from "@/components/investing/public-research"

export async function generateMetadata({
    params,
}: {
    params: Promise<{ symbol: string }>
}): Promise<Metadata> {
    const { symbol } = await params
    const ticker = symbol.toUpperCase()
    return {
        title: `${ticker} — stock research`,
        description: `Chart and company research for ${ticker}. Market data availability and delays vary by exchange.`,
    }
}

export default async function StockPage({ params }: { params: Promise<{ symbol: string }> }) {
    const { symbol } = await params
    return websiteReview.useTradingView ? <PublicStockResearch symbol={symbol} /> : <StockDetailPage symbol={symbol} />
}
