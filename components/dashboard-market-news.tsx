"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Newspaper, ExternalLink } from "lucide-react"
import type { NewsItem } from "@/app/api/market-news/route"

function timeAgo(unixSeconds: number) {
    if (!unixSeconds) return ""
    const diff = Math.floor(Date.now() / 1000) - unixSeconds
    if (diff < 3600) return `${Math.max(1, Math.floor(diff / 60))}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
}

export default function MarketNews() {
    const [items, setItems] = useState<NewsItem[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let active = true
        ;(async () => {
            try {
                const res = await fetch("/api/market-news")
                const json = await res.json()
                if (!res.ok) throw new Error(json.error || "Failed to load news")
                if (active) setItems(json.items)
            } catch (e: any) {
                if (active) setError(e.message)
            } finally {
                if (active) setLoading(false)
            }
        })()
        return () => {
            active = false
        }
    }, [])

    return (
        <Card className="overflow-hidden">
            <CardHeader className="pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                    <Newspaper className="h-5 w-5 text-blue-600" />
                    <CardTitle className="text-lg">Market News</CardTitle>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                {loading ? (
                    <div className="p-4 space-y-3">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
                        ))}
                    </div>
                ) : error ? (
                    <p className="p-6 text-sm text-muted-foreground text-center">{error}</p>
                ) : (
                    <div className="divide-y divide-border/60 max-h-[640px] overflow-y-auto">
                        {items.map((n) => (
                            <a
                                key={n.id}
                                href={n.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex gap-3 p-4 hover:bg-muted/50 transition-colors group"
                            >
                                {n.image ? (
                                    <img
                                        src={n.image}
                                        alt=""
                                        className="w-20 h-16 rounded-md object-cover flex-shrink-0 bg-muted"
                                        onError={(e) => {
                                            ;(e.currentTarget as HTMLImageElement).style.display = "none"
                                        }}
                                    />
                                ) : null}
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                                        <span className="font-semibold uppercase tracking-wide text-blue-600">{n.source}</span>
                                        <span>·</span>
                                        <span>{timeAgo(n.datetime)}</span>
                                    </div>
                                    <p className="text-sm font-semibold leading-snug line-clamp-2 group-hover:text-blue-600 transition-colors">
                                        {n.headline}
                                        <ExternalLink className="inline h-3 w-3 ml-1 align-baseline opacity-0 group-hover:opacity-60" />
                                    </p>
                                    {n.summary && (
                                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{n.summary}</p>
                                    )}
                                </div>
                            </a>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
