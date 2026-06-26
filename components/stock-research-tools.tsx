"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
    ArrowLeft,
    Search,
    TrendingUp,
    TrendingDown,
    DollarSign,
    BarChart3,
    ChevronRight,
} from "lucide-react"

// TradingView Widget Component
const TradingViewWidget = ({ symbol }: { symbol: string }) => {
    const container = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const script = document.createElement("script");
        script.src = "https://s3.tradingview.com/tv.js";
        script.type = "text/javascript";
        script.async = true;
        script.onload = () => {
            if (window.TradingView) {
                new window.TradingView.widget({
                    autosize: true,
                    symbol: symbol,
                    interval: "D",
                    timezone: "Etc/UTC",
                    theme: "light",
                    style: "1",
                    locale: "en",
                    toolbar_bg: "#f1f3f6",
                    enable_publishing: false,
                    allow_symbol_change: true,
                    container_id: container.current?.id
                });
            }
        };
        container.current?.appendChild(script);
    }, [symbol]);

    return (
        <div className="tradingview-widget-container" style={{ height: "400px", width: "100%" }}>
            <div id={`tradingview_${symbol}`} ref={container} style={{ height: "100%", width: "100%" }}></div>
        </div>
    );
};


interface StockResearchToolsProps {
    onBack: () => void
}

interface StockData {
    symbol: string
    name: string
    price: string
    change: string
    changePercent: string
    peRatio: string
    marketCap: string
    description: string
}

interface ChartDataPoint {
    date: string
    price: number
}

interface SearchResult {
    "1. symbol": string
    "2. name": string
    "4. region": string
}

export default function StockResearchTools({ onBack }: StockResearchToolsProps) {
    const [searchTerm, setSearchTerm] = useState("")
    const [activeTab, setActiveTab] = useState("screener")
    const [searchResults, setSearchResults] = useState<SearchResult[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [stockData, setStockData] = useState<StockData | null>(null)
    const [chartData, setChartData] = useState<ChartDataPoint[]>([])
    const [isLoadingDetails, setIsLoadingDetails] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const formatMarketCap = (marketCap: string) => {
        const num = parseInt(marketCap)
        if (isNaN(num) || num === 0) return "N/A"
        if (num >= 1_000_000_000_000) return `$${(num / 1_000_000_000_000).toFixed(2)}T`
        if (num >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(2)}B`
        return `$${(num / 1_000_000).toFixed(2)}M`
    }

    const findSymbols = async () => {
        if (!searchTerm.trim()) return
        setIsSearching(true)
        setError(null)
        setStockData(null)
        setChartData([])
        setSearchResults([])
        try {
            const response = await fetch(`/api/stock-search?keywords=${searchTerm}`)
            const data = await response.json()
            if (!response.ok) throw new Error(data.error || "An error occurred during search.")
            setSearchResults(data)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setIsSearching(false)
        }
    }

    const fetchStockDetails = async (symbol: string) => {
        setIsLoadingDetails(true)
        setError(null)
        setStockData(null)
        setChartData([])
        setSearchResults([])
        try {
            const response = await fetch(`/api/stock?symbol=${symbol}`)
            const data = await response.json()
            if (!response.ok)
                throw new Error(data.error || "An error occurred fetching stock data.")
            const { quote, overview, timeSeries } = data
            if (!quote || !overview || !overview.Name || !timeSeries)
                throw new Error(`Incomplete data found for symbol "${symbol}".`)
            setStockData({
                symbol: quote["01. symbol"],
                name: overview.Name,
                price: `$${parseFloat(quote["05. price"]).toFixed(2)}`,
                change: parseFloat(quote["09. change"]).toFixed(2),
                changePercent: parseFloat(quote["10. change percent"].replace("%", "")).toFixed(2),
                peRatio: overview.PERatio || "N/A",
                marketCap: formatMarketCap(overview.MarketCapitalization),
                description: overview.Description || "No description available.",
            })
            const formattedChartData = Object.entries(timeSeries)
                .map(([date, values]: [string, any]) => ({
                    date: new Date(date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                    }),
                    price: parseFloat(values["4. close"]),
                }))
                .reverse()
                .slice(-30)
            setChartData(formattedChartData)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setIsLoadingDetails(false)
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="outline" size="sm" onClick={onBack}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                </Button>
                <div>
                    <h1 className="text-3xl font-bold">Stock Research Tools</h1>
                    <p className="text-muted-foreground">
                        Simple tools to research and understand investments
                    </p>
                </div>
            </div>

            {/* Tool Tabs */}
            <div className="flex gap-2 border-b">
                <button
                    onClick={() => setActiveTab("screener")}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === "screener"
                            ? "border-primary text-primary"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                >
                    Stock Screener
                </button>
                <button
                    onClick={() => setActiveTab("analysis")}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === "analysis"
                            ? "border-primary text-primary"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                >
                    Company Analysis
                </button>
                <button
                    onClick={() => setActiveTab("portfolio")}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === "portfolio"
                            ? "border-primary text-primary"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                >
                    Portfolio Tracker
                </button>
            </div>

            {/* Stock Screener Tab */}
            {activeTab === "screener" && (
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Find Stocks</CardTitle>
                            <CardDescription>
                                Search for stocks by company name or ticker symbol.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex gap-4 mb-6">
                                <div className="flex-1">
                                    <Input
                                        placeholder="Search by company name or symbol (e.g., Apple, MSFT)"
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        className="w-full"
                                        onKeyDown={e => {
                                            if (e.key === "Enter") findSymbols()
                                        }}
                                    />
                                </div>
                                <Button onClick={findSymbols} disabled={isSearching}>
                                    {isSearching ? (
                                        "Searching..."
                                    ) : (
                                        <>
                                            <Search className="h-4 w-4 mr-2" />
                                            Search
                                        </>
                                    )}
                                </Button>
                            </div>

                            {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

                            <div className="grid gap-4">
                                {/* Search Results */}
                                {searchResults.length > 0 && (
                                    <div className="space-y-2">
                                        <h4 className="font-semibold">Search Results</h4>
                                        {searchResults.map(result => (
                                            <Card
                                                key={result["1. symbol"]}
                                                className="hover:shadow-md transition-shadow cursor-pointer"
                                                onClick={() => fetchStockDetails(result["1. symbol"])}
                                            >
                                                <CardContent className="p-3 flex justify-between items-center">
                                                    <div>
                                                        <span className="font-bold">{result["1. symbol"]}</span>
                                                        <p className="text-sm text-muted-foreground">
                                                            {result["2. name"]}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant="outline">{result["4. region"]}</Badge>
                                                        <ChevronRight className="h-5 w-5 text-gray-400" />
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                )}

                                {/* Loading and Final Data Display */}
                                {isLoadingDetails && (
                                    <p className="text-sm text-muted-foreground">Loading details...</p>
                                )}
                                {stockData && (
                                    <>
                                        <Card className="shadow-md transition-shadow">
                                            <CardContent className="p-4">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <h3 className="font-bold text-lg">
                                                                {stockData.symbol}
                                                            </h3>
                                                            <Badge
                                                                variant={
                                                                    parseFloat(stockData.change) >= 0
                                                                        ? "default"
                                                                        : "destructive"
                                                                }
                                                            >
                                                                {parseFloat(stockData.change) >= 0 ? (
                                                                    <TrendingUp className="h-3 w-3 mr-1" />
                                                                ) : (
                                                                    <TrendingDown className="h-3 w-3 mr-1" />
                                                                )}
                                                                {stockData.changePercent}%
                                                            </Badge>
                                                        </div>
                                                        <p className="text-sm text-muted-foreground truncate">
                                                            {stockData.name}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                                            {stockData.description}
                                                        </p>
                                                    </div>
                                                    <div className="text-right flex-shrink-0 pl-4">
                                                        <div className="text-2xl font-bold">
                                                            {stockData.price}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground">
                                                            P/E: {stockData.peRatio} • Cap: {stockData.marketCap}
                                                        </div>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                        {stockData.symbol && (
                                            <Card>
                                                <CardHeader>
                                                    <CardTitle>TradingView Chart</CardTitle>
                                                </CardHeader>
                                                <CardContent>
                                                    <TradingViewWidget symbol={stockData.symbol} />
                                                </CardContent>
                                            </Card>
                                        )}
                                    </>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
            {/* Other tabs remain unchanged */}
            {activeTab === "analysis" && (
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Company Analysis</CardTitle>
                            <CardDescription>
                                Understand key financial metrics in simple terms
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-lg">Key Metrics Explained</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="space-y-3">
                                            <div className="p-3 border rounded-lg">
                                                <h4 className="font-medium">
                                                    P/E Ratio (Price-to-Earnings)
                                                </h4>
                                                <p className="text-sm text-muted-foreground">
                                                    How much you pay for each dollar of earnings. Lower is
                                                    often better.
                                                </p>
                                            </div>
                                            <div className="p-3 border rounded-lg">
                                                <h4 className="font-medium">Market Cap</h4>
                                                <p className="text-sm text-muted-foreground">
                                                    Total value of all company shares. Shows company size.
                                                </p>
                                            </div>
                                            <div className="p-3 border rounded-lg">
                                                <h4 className="font-medium">Revenue Growth</h4>
                                                <p className="text-sm text-muted-foreground">
                                                    How fast the company is growing its sales year over year.
                                                </p>
                                            </div>
                                            <div className="p-3 border rounded-lg">
                                                <h4 className="font-medium">Debt-to-Equity</h4>
                                                <p className="text-sm text-muted-foreground">
                                                    How much debt vs equity the company has. Lower is safer.
                                                </p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-lg">Analysis Checklist</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2">
                                                <input type="checkbox" className="rounded" />
                                                <span className="text-sm">Company has growing revenue</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <input type="checkbox" className="rounded" />
                                                <span className="text-sm">
													P/E ratio is reasonable (under 30)
												</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <input type="checkbox" className="rounded" />
                                                <span className="text-sm">Company has manageable debt</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <input type="checkbox" className="rounded" />
                                                <span className="text-sm">Business model makes sense</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <input type="checkbox" className="rounded" />
                                                <span className="text-sm">Strong competitive position</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <input type="checkbox" className="rounded" />
                                                <span className="text-sm">Experienced management team</span>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
            {activeTab === "portfolio" && (
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Portfolio Tracker</CardTitle>
                            <CardDescription>
                                Monitor your investments simply and clearly
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="text-center py-12">
                                <DollarSign className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                                <h3 className="text-xl font-semibold mb-2">
                                    Start Tracking Your Portfolio
                                </h3>
                                <p className="text-muted-foreground mb-6">
                                    Add your investments to see performance, allocation, and get
                                    personalized insights.
                                </p>
                                <Button>Add Your First Investment</Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    )
}