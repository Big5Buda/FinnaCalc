"use client"

import { useEffect, useState } from "react"

/**
 * Ambient live waitlist counter. Renders nothing until a real count ≥ 1 loads,
 * so the page never shows a fake or "0" number (honest pre-launch social proof).
 */
export function WaitlistCount({
    prefix = "Join",
    suffix = "others getting early access",
}: {
    prefix?: string
    suffix?: string
}) {
    const [count, setCount] = useState<number | null>(null)

    useEffect(() => {
        let alive = true
        fetch("/api/waitlist")
            .then((r) => r.json())
            .then((d) => {
                if (alive && typeof d?.count === "number") setCount(d.count)
            })
            .catch(() => {})
        return () => {
            alive = false
        }
    }, [])

    if (!count || count < 1) return null

    return (
        <p className="text-sm text-muted-foreground">
            {prefix} <span className="figure font-semibold text-foreground">{count.toLocaleString()}+</span> {suffix}
        </p>
    )
}
