"use client"

import {
    LazyMotion,
    domAnimation,
    m,
    useInView,
    useMotionValue,
    useReducedMotion,
    useScroll,
    useSpring,
    useTransform,
    animate,
    type MotionValue,
} from "framer-motion"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * Motion for the marketing site, on framer-motion (see CLAUDE.md).
 *
 * The system asks for one orchestrated page-load reveal rather than a scatter
 * of independent micro-interactions, so the shape here is a Stagger parent
 * holding Rise children: the parent decides when its group animates, children
 * only declare their place in the order. A section is one gesture, not eight.
 *
 * Every piece honours prefers-reduced-motion by rendering the finished state
 * immediately — no fade, no travel, no counting. Motion is decoration; the page
 * has to be legible without it.
 *
 * LazyMotion + `m` rather than `motion`: it loads the animation features once
 * instead of pulling the full motion bundle into every component.
 */

export function MotionProvider({ children }: { children: ReactNode }) {
    return (
        <LazyMotion features={domAnimation} strict>
            {children}
        </LazyMotion>
    )
}

const EASE = [0.16, 1, 0.3, 1] as const

/**
 * A group that reveals as one thing. Children declare order with `<Rise>`;
 * the stagger belongs to the parent so a section can't drift into eight
 * separately-timed animations.
 */
export function Stagger({
    children,
    className,
    delay = 0,
    once = true,
}: {
    children: ReactNode
    className?: string
    delay?: number
    once?: boolean
}) {
    const reduced = useReducedMotion()
    return (
        <m.div
            className={className}
            initial={reduced ? "shown" : "hidden"}
            whileInView="shown"
            viewport={{ once, margin: "-12% 0px" }}
            variants={{
                hidden: {},
                shown: { transition: { staggerChildren: reduced ? 0 : 0.07, delayChildren: delay } },
            }}
        >
            {children}
        </m.div>
    )
}

/** One element within a Stagger. Outside one it reveals on its own. */
export function Rise({
    children,
    className,
    as = "div",
}: {
    children: ReactNode
    className?: string
    as?: "div" | "section" | "li" | "span" | "p"
}) {
    const reduced = useReducedMotion()
    const Component = m[as]
    return (
        <Component
            className={className}
            variants={{
                hidden: { opacity: 0, y: reduced ? 0 : 18 },
                shown: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
            }}
        >
            {children}
        </Component>
    )
}

/**
 * A number that counts to its value the first time it's seen. The value shown
 * is always the real one — reduced motion simply starts there.
 */
export function CountUp({
    to,
    duration = 1.2,
    format = (value: number) => String(Math.round(value)),
    className,
}: {
    to: number
    duration?: number
    format?: (value: number) => string
    className?: string
}) {
    const reduced = useReducedMotion()
    const ref = useRef<HTMLSpanElement>(null)
    const inView = useInView(ref, { once: true })
    const [display, setDisplay] = useState(() => format(to))

    useEffect(() => {
        if (reduced || !inView) return
        const controls = animate(0, to, {
            duration,
            ease: "easeOut",
            onUpdate: (value) => setDisplay(format(value)),
        })
        return () => controls.stop()
        // `format` is a literal at every call site; re-running on identity would
        // restart the count on each render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [inView, reduced, to, duration])

    return (
        <span ref={ref} className={cn("figure", className)}>
            {display}
        </span>
    )
}

/**
 * Scroll progress through an element, 0…1, spring-smoothed. Returns a value
 * pinned at 0 under reduced motion, so whatever it drives stays at rest.
 */
export function useSectionProgress<T extends HTMLElement>(): {
    ref: React.RefObject<T | null>
    progress: MotionValue<number>
} {
    const ref = useRef<T>(null)
    const reduced = useReducedMotion()
    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ["start end", "end start"],
    })
    const smooth = useSpring(scrollYProgress, { stiffness: 120, damping: 30, restDelta: 0.001 })
    const still = useMotionValue(0)
    return { ref, progress: reduced ? still : smooth }
}

/** The hero's art settles back as the page moves. Rest state under reduced motion. */
export function ScrollSettle({
    children,
    className,
}: {
    children: ReactNode
    className?: string
}) {
    const { ref, progress } = useSectionProgress<HTMLDivElement>()
    const scale = useTransform(progress, [0, 1], [1, 0.88])
    return (
        <div ref={ref} className={className}>
            <m.div style={{ scale }}>{children}</m.div>
        </div>
    )
}

/** Media that pins while its copy scrolls past. Unpinned under reduced motion. */
export function StickyMedia({ children, className }: { children: ReactNode; className?: string }) {
    return <div className={cn("md:sticky md:top-24 motion-reduce:md:static", className)}>{children}</div>
}
