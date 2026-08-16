"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"

/**
 * The symbol watchlist, kept in localStorage under the same key the app uses
 * (`finnacalc.watchlist`, WatchlistStore.swift). Like the budget, it stays on
 * the device.
 */

const KEY = "finnacalc.watchlist"

/** Shown until someone saves their own list; an empty saved list stays empty. */
export const DEFAULT_WATCHLIST = ["AAPL", "MSFT", "NVDA", "AMZN", "GOOGL"]

type WatchlistContextValue = {
    ready: boolean
    symbols: string[]
    /** Null until the user has saved a list of their own. */
    saved: string[] | null
    contains: (symbol: string) => boolean
    toggle: (symbol: string) => boolean
    remove: (symbol: string) => void
    add: (symbol: string) => void
}

const WatchlistContext = createContext<WatchlistContextValue | null>(null)

export function WatchlistProvider({ children }: { children: ReactNode }) {
    const [saved, setSaved] = useState<string[] | null>(null)
    const [ready, setReady] = useState(false)

    useEffect(() => {
        try {
            const raw = window.localStorage.getItem(KEY)
            setSaved(raw ? (JSON.parse(raw) as string[]) : null)
        } catch {
            setSaved(null)
        }
        setReady(true)
    }, [])

    const persist = useCallback((next: string[]) => {
        setSaved(next)
        try {
            window.localStorage.setItem(KEY, JSON.stringify(next))
        } catch {
            /* private mode — the session still works, it just won't persist */
        }
    }, [])

    const symbols = useMemo(() => saved ?? DEFAULT_WATCHLIST, [saved])

    const contains = useCallback(
        (symbol: string) => symbols.some((entry) => entry.toUpperCase() === symbol.toUpperCase()),
        [symbols]
    )

    const toggle = useCallback(
        (symbol: string) => {
            const upper = symbol.toUpperCase()
            const current = saved ?? DEFAULT_WATCHLIST
            if (current.some((entry) => entry.toUpperCase() === upper)) {
                persist(current.filter((entry) => entry.toUpperCase() !== upper))
                return false
            }
            persist([...current, upper])
            return true
        },
        [saved, persist]
    )

    const add = useCallback(
        (symbol: string) => {
            const upper = symbol.toUpperCase()
            const current = saved ?? DEFAULT_WATCHLIST
            if (!current.some((entry) => entry.toUpperCase() === upper)) persist([...current, upper])
        },
        [saved, persist]
    )

    const remove = useCallback(
        (symbol: string) => {
            const upper = symbol.toUpperCase()
            persist((saved ?? DEFAULT_WATCHLIST).filter((entry) => entry.toUpperCase() !== upper))
        },
        [saved, persist]
    )

    const value = useMemo(
        () => ({ ready, symbols, saved, contains, toggle, remove, add }),
        [ready, symbols, saved, contains, toggle, remove, add]
    )

    return <WatchlistContext.Provider value={value}>{children}</WatchlistContext.Provider>
}

export function useWatchlist(): WatchlistContextValue {
    const ctx = useContext(WatchlistContext)
    if (!ctx) throw new Error("useWatchlist must be used inside <WatchlistProvider>")
    return ctx
}
