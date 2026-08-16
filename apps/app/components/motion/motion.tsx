"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * Motion primitives for the marketing layout: scroll reveals, a scroll-driven
 * hero, sticky section transitions and number counters.
 *
 * Every one of them checks `prefers-reduced-motion` and, when it's set, renders
 * the finished state immediately — no fades, no counting, no transforms. Motion
 * is decoration here; nothing depends on it to become readable.
 */

export function useReducedMotion(): boolean {
    const [reduced, setReduced] = useState(false)
    useEffect(() => {
        const media = window.matchMedia("(prefers-reduced-motion: reduce)")
        setReduced(media.matches)
        const onChange = () => setReduced(media.matches)
        media.addEventListener("change", onChange)
        return () => media.removeEventListener("change", onChange)
    }, [])
    return reduced
}

/** Fires once when the element first comes into view. */
function useInView<T extends HTMLElement>(rootMargin = "-12% 0px") {
    const ref = useRef<T | null>(null)
    const [inView, setInView] = useState(false)

    useEffect(() => {
        const node = ref.current
        if (!node) return
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    setInView(true)
                    observer.disconnect()
                }
            },
            { rootMargin }
        )
        observer.observe(node)
        return () => observer.disconnect()
    }, [rootMargin])

    return { ref, inView }
}

/** Fade-and-rise as the block enters. `delay` staggers siblings. */
export function Reveal({
    children,
    delay = 0,
    className,
    as: Tag = "div",
}: {
    children: ReactNode
    delay?: number
    className?: string
    as?: "div" | "section" | "li" | "span"
}) {
    const reduced = useReducedMotion()
    const { ref, inView } = useInView<HTMLDivElement>()
    const shown = reduced || inView

    return (
        <Tag
            ref={ref as never}
            className={cn(
                "transition-[opacity,transform] duration-700 ease-out motion-reduce:transition-none",
                shown ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0",
                className
            )}
            style={shown && !reduced ? { transitionDelay: `${delay}ms` } : undefined}
        >
            {children}
        </Tag>
    )
}

/**
 * A number that counts up the first time it's seen. The value shown is always
 * the real one — reduced motion (and the server render) simply start there.
 */
export function CountUp({
    to,
    duration = 1200,
    format = (value: number) => String(Math.round(value)),
    className,
}: {
    to: number
    duration?: number
    format?: (value: number) => string
    className?: string
}) {
    const reduced = useReducedMotion()
    const { ref, inView } = useInView<HTMLSpanElement>("0px")
    const [value, setValue] = useState(to)

    useEffect(() => {
        if (reduced || !inView) return
        let frame = 0
        const start = performance.now()
        const tick = (now: number) => {
            const progress = Math.min(1, (now - start) / duration)
            // Ease-out cubic: quick off the mark, settles onto the real figure.
            setValue(to * (1 - Math.pow(1 - progress, 3)))
            if (progress < 1) frame = requestAnimationFrame(tick)
        }
        setValue(0)
        frame = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(frame)
    }, [inView, reduced, to, duration])

    return (
        <span ref={ref} className={className}>
            {format(value)}
        </span>
    )
}

/**
 * Scroll progress through an element, 0…1. Drives the hero's scale and the
 * sticky sections; returns 0 forever under reduced motion, so whatever it
 * drives stays at its resting state.
 */
export function useScrollProgress<T extends HTMLElement>() {
    const ref = useRef<T | null>(null)
    const [progress, setProgress] = useState(0)
    const reduced = useReducedMotion()

    useEffect(() => {
        if (reduced) return
        const node = ref.current
        if (!node) return

        let frame = 0
        const measure = () => {
            frame = 0
            const rect = node.getBoundingClientRect()
            const total = rect.height + window.innerHeight
            const seen = window.innerHeight - rect.top
            setProgress(Math.min(1, Math.max(0, seen / total)))
        }
        const onScroll = () => {
            if (frame === 0) frame = requestAnimationFrame(measure)
        }

        measure()
        window.addEventListener("scroll", onScroll, { passive: true })
        window.addEventListener("resize", onScroll)
        return () => {
            window.removeEventListener("scroll", onScroll)
            window.removeEventListener("resize", onScroll)
            if (frame) cancelAnimationFrame(frame)
        }
    }, [reduced])

    return { ref, progress }
}

/**
 * A tall section whose media pins while the copy scrolls past it — the
 * alternating product blocks. Under reduced motion the media simply sits at the
 * top of its column, unpinned.
 */
export function StickyMedia({
    children,
    className,
}: {
    children: ReactNode
    className?: string
}) {
    return (
        <div className={cn("md:sticky md:top-24 motion-reduce:md:static", className)}>{children}</div>
    )
}
