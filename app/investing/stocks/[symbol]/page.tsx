import type { Metadata } from "next"
import { StockDetailPage } from "@/components/investing/stock-detail"

export async function generateMetadata({
    params,
}: {
    params: Promise<{ symbol: string }>
}): Promise<Metadata> {
    const { symbol } = await params
    const ticker = symbol.toUpperCase()
    return {
        title: `${ticker} — price, chart and filings`,
        description: `Live price, chart, key stats and SEC financials for ${ticker}.`,
    }
}

export default async function StockPage({ params }: { params: Promise<{ symbol: string }> }) {
    const { symbol } = await params
    return <StockDetailPage symbol={symbol} />
}
