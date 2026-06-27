"use client"

import { useEffect, useRef, useState } from "react"
import { useTheme } from "next-themes"

interface TradingViewMiniProps {
    symbol: string
    height?: number
}

/**
 * Compact TradingView "mini symbol overview" widget — a sparkline + price used
 * for watchlist tiles. Each instance is an independent embed.
 */
export default function TradingViewMini({ symbol, height = 140 }: TradingViewMiniProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const { resolvedTheme } = useTheme()
    const [mounted, setMounted] = useState(false)

    useEffect(() => setMounted(true), [])

    useEffect(() => {
        if (!mounted || !containerRef.current) return
        const container = containerRef.current
        container.innerHTML = ""
        const script = document.createElement("script")
        script.src = "https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js"
        script.async = true
        script.type = "text/javascript"
        script.innerHTML = JSON.stringify({
            symbol,
            width: "100%",
            height,
            locale: "en",
            dateRange: "1M",
            colorTheme: resolvedTheme === "dark" ? "dark" : "light",
            isTransparent: true,
            autosize: false,
            largeChartUrl: "",
        })
        container.appendChild(script)
    }, [symbol, resolvedTheme, mounted, height])

    return (
        <div style={{ height }}>
            {mounted ? (
                <div className="tradingview-widget-container" ref={containerRef} style={{ height }} />
            ) : (
                <div className="h-full w-full animate-pulse bg-muted rounded" />
            )}
        </div>
    )
}
