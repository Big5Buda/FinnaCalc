"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"

/**
 * System / Light / Dark, the same three-way choice the iOS app keeps in
 * Core/DesignSystem/AppearanceSetting.swift (surfaced on the Account page).
 * The choice is stored in localStorage and applied as a `dark` class on
 * <html>; the inline script in app/layout.tsx applies it before first paint so
 * the page never flashes the wrong scheme.
 */

export type Appearance = "system" | "light" | "dark"

export const APPEARANCE_KEY = "finnacalc.appearance"

type AppearanceContextValue = {
    appearance: Appearance
    setAppearance: (value: Appearance) => void
}

const AppearanceContext = createContext<AppearanceContextValue | null>(null)

function apply(appearance: Appearance) {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
    const dark = appearance === "dark" || (appearance === "system" && prefersDark)
    document.documentElement.classList.toggle("dark", dark)
    document.documentElement.style.colorScheme = dark ? "dark" : "light"
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
    const [appearance, setAppearanceState] = useState<Appearance>("system")

    useEffect(() => {
        const stored = window.localStorage.getItem(APPEARANCE_KEY) as Appearance | null
        const initial: Appearance = stored === "light" || stored === "dark" ? stored : "system"
        setAppearanceState(initial)
        apply(initial)
    }, [])

    // Follow the OS while the choice is "system".
    useEffect(() => {
        if (appearance !== "system") return
        const media = window.matchMedia("(prefers-color-scheme: dark)")
        const onChange = () => apply("system")
        media.addEventListener("change", onChange)
        return () => media.removeEventListener("change", onChange)
    }, [appearance])

    const setAppearance = useCallback((value: Appearance) => {
        setAppearanceState(value)
        window.localStorage.setItem(APPEARANCE_KEY, value)
        apply(value)
    }, [])

    const value = useMemo(() => ({ appearance, setAppearance }), [appearance, setAppearance])
    return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>
}

export function useAppearance(): AppearanceContextValue {
    const ctx = useContext(AppearanceContext)
    if (!ctx) throw new Error("useAppearance must be used inside <AppearanceProvider>")
    return ctx
}
