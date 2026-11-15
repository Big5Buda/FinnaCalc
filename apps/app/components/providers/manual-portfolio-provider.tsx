"use client"
import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { decodePortfolio, encodePortfolio, MANUAL_PORTFOLIO_KEY, saveHolding, type ManualHolding } from "@/lib/manual-portfolio"

type Portfolio = { holdings: ManualHolding[]; ready: boolean; notice: string | null; save: (holding: ManualHolding) => void; remove: (symbol: string) => void; undo: () => void; canUndo: boolean }
const Context = createContext<Portfolio | null>(null)
export function ManualPortfolioProvider({ children }: { children: ReactNode }) {
    const [holdings, setHoldings] = useState<ManualHolding[]>([])
    const [ready, setReady] = useState(false)
    const [notice, setNotice] = useState<string | null>(null)
    const [removed, setRemoved] = useState<ManualHolding | null>(null)
    useEffect(() => {
        const load = () => {
            try { setHoldings(decodePortfolio(localStorage.getItem(MANUAL_PORTFOLIO_KEY))); setNotice(null) }
            catch { setNotice("Saved portfolio data could not be read. It has not been overwritten.") }
            setReady(true)
        }
        load()
        const sync = (event: StorageEvent) => { if (event.key === MANUAL_PORTFOLIO_KEY || event.key === null) load() }
        window.addEventListener("storage", sync)
        return () => window.removeEventListener("storage", sync)
    }, [])
    const persist = (next: ManualHolding[]) => {
        try { localStorage.setItem(MANUAL_PORTFOLIO_KEY, encodePortfolio(next)); setNotice(null) }
        catch { setNotice("Browser storage is unavailable. Changes will be lost when this page is reloaded.") }
        setHoldings(next)
    }
    return <Context.Provider value={{ holdings, ready, notice,
        save: h => { if (!ready) throw new Error("Your portfolio is still loading."); persist(saveHolding(holdings, h)); setRemoved(null) },
        remove: symbol => { setRemoved(holdings.find(h => h.symbol === symbol) ?? null); persist(holdings.filter(h => h.symbol !== symbol)) },
        undo: () => { if (removed) { persist(saveHolding(holdings, removed)); setRemoved(null) } }, canUndo: removed !== null,
    }}>{children}</Context.Provider>
}
export function useManualPortfolio() {
    const value = useContext(Context)
    if (!value) throw new Error("ManualPortfolioProvider is missing")
    return value
}
