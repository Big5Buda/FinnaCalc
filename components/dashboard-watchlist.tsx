"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Star, Plus, X } from "lucide-react"
import TradingViewMini from "@/components/tradingview-mini"

const STORAGE_KEY = "finnacalc.watchlist"
const DEFAULT_SYMBOLS = ["AAPL", "TSLA", "NVDA", "MSFT", "AMZN", "META", "GOOGL", "BINANCE:BTCUSDT"]

export default function Watchlist() {
    const [symbols, setSymbols] = useState<string[]>(DEFAULT_SYMBOLS)
    const [adding, setAdding] = useState(false)
    const [draft, setDraft] = useState("")

    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY)
            if (raw) {
                const parsed = JSON.parse(raw)
                if (Array.isArray(parsed) && parsed.length) setSymbols(parsed)
            }
        } catch {
            /* ignore */
        }
    }, [])

    const persist = (next: string[]) => {
        setSymbols(next)
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
        } catch {
            /* ignore */
        }
    }

    const addSymbol = () => {
        const s = draft.trim().toUpperCase()
        if (!s) return
        if (!symbols.includes(s)) persist([...symbols, s])
        setDraft("")
        setAdding(false)
    }

    const remove = (s: string) => persist(symbols.filter((x) => x !== s))

    return (
        <Card className="overflow-hidden">
            <CardHeader className="pb-3 border-b border-border">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Star className="h-5 w-5 text-blue-600" />
                        <CardTitle className="text-lg">My Watchlist</CardTitle>
                    </div>
                    {adding ? (
                        <div className="flex items-center gap-2">
                            <Input
                                autoFocus
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && addSymbol()}
                                placeholder="Ticker e.g. AMD"
                                className="h-8 w-36"
                            />
                            <Button size="sm" className="h-8 bg-blue-600 hover:bg-blue-700" onClick={addSymbol}>Add</Button>
                            <Button size="sm" variant="ghost" className="h-8" onClick={() => { setAdding(false); setDraft("") }}>Cancel</Button>
                        </div>
                    ) : (
                        <Button size="sm" variant="outline" className="h-8" onClick={() => setAdding(true)}>
                            <Plus className="h-3.5 w-3.5 mr-1.5" /> Add
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent className="pt-5">
                <div className="grid grid-cols-4 gap-4">
                    {symbols.map((s) => (
                        <div key={s} className="relative rounded-xl border border-border p-2 group">
                            <button
                                onClick={() => remove(s)}
                                className="absolute top-1.5 right-1.5 z-10 w-5 h-5 rounded-full bg-muted hover:bg-red-500 hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                aria-label={`Remove ${s}`}
                            >
                                <X className="h-3 w-3" />
                            </button>
                            <TradingViewMini symbol={s} height={140} />
                        </div>
                    ))}
                    {symbols.length === 0 && (
                        <p className="col-span-4 text-sm text-muted-foreground text-center py-8">
                            Your watchlist is empty. Add a ticker to track it here.
                        </p>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
