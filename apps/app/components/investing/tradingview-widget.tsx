"use client"
import { useEffect, useRef, useState } from "react"
import { useAppearance } from "@/components/providers/appearance-provider"
import { TRADINGVIEW_SCRIPTS, widgetConfiguration, type WidgetKind } from "@/lib/tradingview"

/** Official self-contained displays; no iframe data is read, copied or used for calculations. */
export function TradingViewWidget({ kind, symbol, title, height = 500 }: { kind: WidgetKind; symbol?: string; title: string; height?: number }) {
    const host = useRef<HTMLDivElement>(null)
    const { appearance } = useAppearance()
    const [dark, setDark] = useState<boolean | null>(null)
    const [failed, setFailed] = useState(false)
    const [ready, setReady] = useState(false)
    useEffect(() => {
        const media = window.matchMedia("(prefers-color-scheme: dark)")
        const apply = () => setDark(appearance === "dark" || (appearance === "system" && media.matches))
        apply(); media.addEventListener("change", apply)
        return () => media.removeEventListener("change", apply)
    }, [appearance])
    useEffect(() => {
        if (!host.current || dark === null) return
        setFailed(false); setReady(false)
        const root = document.createElement("div")
        root.className = "tradingview-widget-container"
        root.style.cssText = "height:100%;width:100%"
        const target = document.createElement("div")
        target.className = "tradingview-widget-container__widget"
        target.style.cssText = "height:100%;width:100%"
        root.appendChild(target)
        host.current.appendChild(root)
        let active = true
        const observer = new MutationObserver(() => {
            const frame = root.querySelector("iframe")
            if (frame) { frame.title = title; if (active) setReady(true) }
        })
        observer.observe(root, { childList: true, subtree: true })
        const script = document.createElement("script")
        script.src = `https://s3.tradingview.com/external-embedding/${TRADINGVIEW_SCRIPTS[kind]}`
        script.async = true
        script.type = "text/javascript"
        script.textContent = JSON.stringify(widgetConfiguration(kind, dark, symbol, `${window.location.origin}/investing/research`))
        script.onerror = () => { if (active) setFailed(true) }
        root.appendChild(script)
        return () => { active = false; observer.disconnect(); root.remove() }
    }, [kind, symbol, dark, title])
    return <section aria-label={title} className="min-w-0">
        {failed ? <div className="rounded-xl border border-border bg-card p-6 text-sm">The market display could not load. Check your connection or content blocker and reload.</div> :
            <div className="relative overflow-hidden rounded-xl border border-border bg-card" style={{ height }}>
                {!ready && <p role="status" className="absolute left-4 top-4 text-sm text-muted-foreground">Loading market display…</p>}
                <div ref={host} className="relative h-full w-full" />
            </div>}
        <p className="mt-2 text-xs text-muted-foreground"><a href="https://www.tradingview.com/" target="_blank" rel="noopener noreferrer" className="underline">{title} by TradingView</a></p>
    </section>
}
export function MarketDisplayNote() {
    return <p className="text-xs leading-relaxed text-muted-foreground">Market displays are provided by TradingView. Prices may be delayed; availability varies by symbol and exchange. They are separate from your manually entered portfolio values.</p>
}
