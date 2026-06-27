"use client"

import { useEffect, useRef, useState } from "react"
import { useTheme } from "next-themes"

interface TradingViewNewsProps {
    height?: number
}

/**
 * TradingView "Timeline" news widget — a real-time stream of market headlines.
 * Unlike a polled REST feed, stories appear as they break (no cache delay,
 * no rate limit). Theme follows the app's light/dark mode.
 */
export default function TradingViewNews({ height = 600 }: TradingViewNewsProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const { resolvedTheme } = useTheme()
    const [mounted, setMounted] = useState(false)

    useEffect(() => setMounted(true), [])

    useEffect(() => {
        if (!mounted || !containerRef.current) return
        const container = containerRef.current
        container.innerHTML = ""
        const script = document.createElement("script")
        script.src = "https://s3.tradingview.com/external-embedding/embed-widget-timeline.js"
        script.async = true
        script.type = "text/javascript"
        script.innerHTML = JSON.stringify({
            feedMode: "market",
            market: "stock",
            isTransparent: true,
            displayMode: "regular",
            width: "100%",
            height,
            colorTheme: resolvedTheme === "dark" ? "dark" : "light",
            locale: "en",
        })
        container.appendChild(script)
    }, [mounted, resolvedTheme, height])

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
