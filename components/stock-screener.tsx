"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, TrendingUp, TrendingDown, ChevronRight } from "lucide-react"
import TradingViewChart from "@/components/tradingview-chart"

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

interface SearchResult {
    "1. symbol": string
    "2. name": string
    "4. region": string
}

function formatMarketCap(marketCap: string) {
    const num = parseInt(marketCap)
    if (isNaN(num) || num === 0) return "N/A"
    if (num >= 1_000_000_000_000) return `$${(num / 1_000_000_000_000).toFixed(2)}T`
    if (num >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(2)}B`
    return `$${(num / 1_000_000).toFixed(2)}M`
}

export default function StockScreener() {
    const [searchTerm, setSearchTerm] = useState("")
    const [searchResults, setSearchResults] = useState<SearchResult[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [stockData, setStockData] = useState<StockData | null>(null)
    const [isLoadingDetails, setIsLoadingDetails] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Live typeahead — surface matches as the user types (debounced).
    useEffect(() => {
        const term = searchTerm.trim()
        if (term.length < 2) {
            setSearchResults([])
            return
        }
        const controller = new AbortController()
        const timer = setTimeout(async () => {
            setIsSearching(true)
            setError(null)
            try {
                const res = await fetch(`/api/stock-search?keywords=${encodeURIComponent(term)}`, {
                    signal: controller.signal,
                })
                const json = await res.json()
                if (!res.ok) throw new Error(json.error || "Search failed.")
                setSearchResults(json)
            } catch (e: any) {
                if (e?.name !== "AbortError") setSearchResults([])
            } finally {
                setIsSearching(false)
            }
        }, 250)
        return () => {
            clearTimeout(timer)
            controller.abort()
        }
    }, [searchTerm])

    const findSymbols = async () => {
        if (!searchTerm.trim()) return
        setIsSearching(true)
        setError(null)
        setStockData(null)
        setSearchResults([])
        try {
            const response = await fetch(`/api/stock-search?keywords=${encodeURIComponent(searchTerm)}`)
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
        setSearchResults([])
        try {
            const response = await fetch(`/api/stock?symbol=${symbol}`)
            const data = await response.json()
            if (!response.ok) throw new Error(data.error || "An error occurred fetching stock data.")
            const { quote, overview } = data
            if (!quote || !overview || !overview.Name)
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
        } catch (err: any) {
            setError(err.message)
        } finally {
            setIsLoadingDetails(false)
        }
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Stock Screener</CardTitle>
                    <CardDescription>Search any stock to view its fundamentals and live chart.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-3 mb-6">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by company name or symbol (e.g., Apple, MSFT)"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-9"
                                onKeyDown={e => {
                                    if (e.key !== "Enter") return
                                    if (searchResults.length > 0) fetchStockDetails(searchResults[0]["1. symbol"])
                                    else findSymbols()
                                }}
                            />
                        </div>
                        <Button onClick={findSymbols} disabled={isSearching} className="bg-blue-600 hover:bg-blue-700">
                            <Search className="h-4 w-4 mr-2" />
                            {isSearching ? "Searching…" : "Search"}
                        </Button>
                    </div>

                    {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

                    <div className="grid gap-4">
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
                                                <p className="text-sm text-muted-foreground">{result["2. name"]}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline">{result["4. region"]}</Badge>
                                                <ChevronRight className="h-5 w-5 text-muted-foreground" />
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}

                        {isLoadingDetails && <p className="text-sm text-muted-foreground">Loading details…</p>}

                        {stockData && (
                            <>
                                <Card className="shadow-md">
                                    <CardContent className="p-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-bold text-lg">{stockData.symbol}</h3>
                                                    <Badge variant={parseFloat(stockData.change) >= 0 ? "default" : "destructive"}>
                                                        {parseFloat(stockData.change) >= 0 ? (
                                                            <TrendingUp className="h-3 w-3 mr-1" />
                                                        ) : (
                                                            <TrendingDown className="h-3 w-3 mr-1" />
                                                        )}
                                                        {stockData.changePercent}%
                                                    </Badge>
                                                </div>
                                                <p className="text-sm text-muted-foreground truncate">{stockData.name}</p>
                                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{stockData.description}</p>
                                            </div>
                                            <div className="text-right flex-shrink-0 pl-4">
                                                <div className="text-2xl font-bold">{stockData.price}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    P/E: {stockData.peRatio} • Cap: {stockData.marketCap}
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-base">{stockData.symbol} · Live Chart</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <TradingViewChart symbol={stockData.symbol} height={460} />
                                    </CardContent>
                                </Card>
                            </>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Educational reference — understanding the metrics above */}
            <div className="grid grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Key Metrics Explained</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="p-3 border rounded-lg">
                            <h4 className="font-medium">P/E Ratio (Price-to-Earnings)</h4>
                            <p className="text-sm text-muted-foreground">How much you pay for each dollar of earnings. Lower is often better.</p>
                        </div>
                        <div className="p-3 border rounded-lg">
                            <h4 className="font-medium">Market Cap</h4>
                            <p className="text-sm text-muted-foreground">Total value of all company shares. Shows company size.</p>
                        </div>
                        <div className="p-3 border rounded-lg">
                            <h4 className="font-medium">Revenue Growth</h4>
                            <p className="text-sm text-muted-foreground">How fast the company is growing its sales year over year.</p>
                        </div>
                        <div className="p-3 border rounded-lg">
                            <h4 className="font-medium">Debt-to-Equity</h4>
                            <p className="text-sm text-muted-foreground">How much debt vs equity the company has. Lower is safer.</p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Analysis Checklist</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {[
                                "Company has growing revenue",
                                "P/E ratio is reasonable (under 30)",
                                "Company has manageable debt",
                                "Business model makes sense",
                                "Strong competitive position",
                                "Experienced management team",
                            ].map(item => (
                                <label key={item} className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" className="rounded" />
                                    <span className="text-sm">{item}</span>
                                </label>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
