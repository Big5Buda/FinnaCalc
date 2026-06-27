"use client"

import { useEffect, useId, useRef, useState } from "react"
import { useTheme } from "next-themes"

declare global {
    interface Window {
        TradingView?: any
    }
}

// Load TradingView's tv.js exactly once and share the promise across instances.
let tvScriptPromise: Promise<void> | null = null
function loadTradingViewScript(): Promise<void> {
    if (typeof window === "undefined") return Promise.resolve()
    if (window.TradingView) return Promise.resolve()
    if (!tvScriptPromise) {
        tvScriptPromise = new Promise<void>((resolve, reject) => {
            const existing = document.getElementById("tradingview-tv-js") as HTMLScriptElement | null
            if (existing) {
                existing.addEventListener("load", () => resolve())
                existing.addEventListener("error", () => reject(new Error("tv.js failed")))
                return
            }
            const script = document.createElement("script")
            script.id = "tradingview-tv-js"
            script.src = "https://s3.tradingview.com/tv.js"
            script.async = true
            script.onload = () => resolve()
            script.onerror = () => reject(new Error("tv.js failed"))
            document.head.appendChild(script)
        })
    }
    return tvScriptPromise
}

interface TradingViewChartProps {
    symbol: string
    height?: number
}

/**
 * Universal TradingView Advanced Chart. Renders an interactive, real-time
 * price chart for any ticker. Theme follows the app's light/dark mode and the
 * widget is rebuilt when the symbol or theme changes.
 */
export default function TradingViewChart({ symbol, height = 480 }: TradingViewChartProps) {
    const reactId = useId()
    const containerId = `tv_${reactId.replace(/[:]/g, "_")}`
    const containerRef = useRef<HTMLDivElement>(null)
    const { resolvedTheme } = useTheme()
    const [mounted, setMounted] = useState(false)
    const [failed, setFailed] = useState(false)

    useEffect(() => setMounted(true), [])

    useEffect(() => {
        if (!mounted || !symbol) return
        let cancelled = false
        setFailed(false)

        loadTradingViewScript()
            .then(() => {
                if (cancelled || !containerRef.current || !window.TradingView) return
                // Clear any previous widget (symbol/theme change) before recreating.
                containerRef.current.innerHTML = ""
                new window.TradingView.widget({
                    autosize: true,
                    symbol,
                    interval: "D",
                    timezone: "Etc/UTC",
                    theme: resolvedTheme === "dark" ? "dark" : "light",
                    style: "1",
                    locale: "en",
                    enable_publishing: false,
                    allow_symbol_change: true,
                    hide_side_toolbar: false,
                    withdateranges: true,
                    container_id: containerId,
                })
            })
            .catch(() => {
                if (!cancelled) setFailed(true)
            })

        return () => {
            cancelled = true
        }
    }, [symbol, resolvedTheme, mounted, containerId])

    return (
        <div className="rounded-lg overflow-hidden border border-border bg-muted/30" style={{ height, width: "100%" }}>
            {failed ? (
                <div className="h-full w-full flex items-center justify-center text-sm text-muted-foreground">
                    Unable to load the chart right now. Please try again later.
                </div>
            ) : (
                <div id={containerId} ref={containerRef} style={{ height: "100%", width: "100%" }}>
                    {!mounted && <div className="h-full w-full animate-pulse bg-muted" />}
                </div>
            )}
        </div>
    )
}
