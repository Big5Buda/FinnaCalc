"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { ArrowLeft, Search, TrendingUp, TrendingDown } from "lucide-react"
import TradingViewChart from "@/components/tradingview-chart"

interface StocksPageProps {
    onBack: () => void;
    initialSymbol?: string;
}

interface StockData {
    symbol: string
    name: string
    price: number
    change: number
    changePercent: number
    marketCap: string
    description: string
    logo: string; // <-- ADDED THIS
}

interface SearchResult {
    "1. symbol": string
    "2. name": string
}

export default function StocksPage({ onBack, initialSymbol }: StocksPageProps) {
    const [searchTerm, setSearchTerm] = useState("");
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [selectedStock, setSelectedStock] = useState<StockData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
    const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
    const [tradeQuantity, setTradeQuantity] = useState(1);

    useEffect(() => {
        if (initialSymbol) {
            fetchStockDetails(initialSymbol);
        }
    }, [initialSymbol]);

    const handleSearch = async () => {
        if (!searchTerm.trim()) return;
        setIsLoading(true);
        setError(null);
        setSelectedStock(null);
        setSearchResults([]);

        try {
            const response = await fetch(`/api/stock-search?keywords=${searchTerm}`);
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Search failed.");
            setSearchResults(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchStockDetails = async (symbol: string) => {
        setIsLoading(true);
        setError(null);
        setSelectedStock(null);
        setSearchResults([]);

        try {
            const response = await fetch(`/api/stock?symbol=${symbol}`);
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Failed to fetch stock data.");

            const { quote, overview } = data;
            setSelectedStock({
                symbol: quote["01. symbol"],
                name: overview.Name,
                price: parseFloat(quote["05. price"]),
                change: parseFloat(quote["09. change"]),
                changePercent: parseFloat(quote["10. change percent"].replace("%", "")),
                marketCap: overview.MarketCapitalization,
                description: overview.Description,
                logo: overview.Logo, // <-- ADDED THIS
            });
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const openTradeModal = (type: 'buy' | 'sell') => {
        setTradeType(type);
        setTradeQuantity(1);
        setIsTradeModalOpen(true);
    };

    const handleTrade = () => {
        alert(`${tradeType === 'buy' ? 'Buying' : 'Selling'} ${tradeQuantity} share(s) of ${selectedStock?.symbol}. (This is a demo action)`);
        setIsTradeModalOpen(false);
    };

    return (
        <div className="space-y-6">
            <Button variant="outline" size="sm" onClick={onBack} className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Investing
            </Button>

            <Card>
                <CardHeader>
                    <CardTitle>Search Stocks</CardTitle>
                    <div className="flex gap-2 mt-4">
                        <Input
                            placeholder="e.g., AAPL, Microsoft"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        />
                        <Button onClick={handleSearch} disabled={isLoading}>
                            <Search className="h-4 w-4 mr-2" />
                            {isLoading ? 'Searching...' : 'Search'}
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {error && <p className="text-red-500 text-sm">{error}</p>}
                    {searchResults.length > 0 && (
                        <div className="space-y-2">
                            {searchResults.map((result) => (
                                <div key={result["1. symbol"]} onClick={() => fetchStockDetails(result["1. symbol"])} className="p-2 rounded-md hover:bg-muted cursor-pointer">
                                    <p className="font-bold">{result["1. symbol"]}</p>
                                    <p className="text-sm text-muted-foreground">{result["2. name"]}</p>
                                </div>
                            ))}
                        </div>
                    )}
                    {selectedStock && (
                        <div className="space-y-4 mt-4">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-4">
                                    <img src={selectedStock.logo} alt={`${selectedStock.name} logo`} className="h-12 w-12 rounded-full bg-background border" />
                                    <div>
                                        <h3 className="text-xl font-bold">{selectedStock.name} ({selectedStock.symbol})</h3>
                                        <p className="text-2xl font-bold">${selectedStock.price.toFixed(2)}</p>
                                        <p className={`text-sm font-medium ${selectedStock.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {selectedStock.change.toFixed(2)} ({selectedStock.changePercent.toFixed(2)}%)
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-2 flex-shrink-0">
                                    <Button onClick={() => openTradeModal('buy')} className="bg-green-600 hover:bg-green-700">Buy</Button>
                                    <Button onClick={() => openTradeModal('sell')} variant="outline">Sell</Button>
                                </div>
                            </div>

                            <TradingViewChart symbol={selectedStock.symbol} height={420} />
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={isTradeModalOpen} onOpenChange={setIsTradeModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {tradeType === 'buy' ? 'Buy' : 'Sell'} {selectedStock?.symbol}
                        </DialogTitle>
                        <DialogDescription>
                            Current Price: ${selectedStock?.price.toFixed(2)}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <label htmlFor="quantity">Quantity</label>
                        <Input
                            id="quantity"
                            type="number"
                            min="1"
                            value={tradeQuantity}
                            onChange={(e) => setTradeQuantity(parseInt(e.target.value) || 1)}
                        />
                        <p className="font-bold">
                            Total: ${(selectedStock ? selectedStock.price * tradeQuantity : 0).toFixed(2)}
                        </p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsTradeModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleTrade} className={tradeType === 'buy' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}>
                            Confirm {tradeType === 'buy' ? 'Buy' : 'Sell'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}