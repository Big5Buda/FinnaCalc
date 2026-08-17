"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * The layout vocabulary every workspace screen is built from, matched to the
 * reference's logged-in app.
 *
 * PageBar   the thin top strip: title on the left, actions on the right
 * Panel     a warm-white card on the cream ground — the default surface
 * EmptyState  an illustration slot, a sentence, and one action
 * ActionPill  ink or hairline, always fully round
 *
 * These exist so ~35 screens can adopt the new shell by composing rather than
 * each inventing its own card. Nothing here holds state.
 */

export function PageBar({
    title,
    actions,
}: {
    title: ReactNode
    actions?: ReactNode
}) {
    return (
        <div className="flex min-h-[68px] flex-wrap items-center justify-between gap-3 px-6 py-4 lg:px-10">
            <h1 className="text-[17px] font-semibold tracking-[-0.01em] text-foreground">{title}</h1>
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
    )
}

/** The page's content column, under the bar. */
export function PageBody({
    children,
    className,
}: {
    children: ReactNode
    className?: string
}) {
    return <div className={cn("px-6 pb-20 lg:px-10", className)}>{children}</div>
}

export function Panel({
    children,
    className,
    padded = true,
}: {
    children: ReactNode
    className?: string
    padded?: boolean
}) {
    return (
        <section
            className={cn(
                "rounded-card border border-border bg-card",
                padded && "p-6",
                className
            )}
        >
            {children}
        </section>
    )
}

export function PanelTitle({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <h2 className={cn("text-base font-semibold text-foreground", className)}>{children}</h2>
    )
}

/**
 * An empty state that says what's missing and offers the one action that fixes
 * it. Never a dead end, and never a fake preview of data the reader doesn't
 * have — the house rule about fabricated figures applies hardest here, where a
 * plausible-looking sample is most tempting.
 */
export function EmptyState({
    icon,
    title,
    body,
    action,
    className,
}: {
    icon?: ReactNode
    title: string
    body?: string
    action?: ReactNode
    className?: string
}) {
    return (
        <div className={cn("flex flex-col items-center gap-3 px-6 py-14 text-center", className)}>
            {icon && (
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-pill bg-secondary text-muted-foreground">
                    {icon}
                </span>
            )}
            <p className="text-base font-semibold text-foreground">{title}</p>
            {body && <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{body}</p>}
            {action && <div className="pt-2">{action}</div>}
        </div>
    )
}

export function ActionPill({
    href,
    onClick,
    children,
    tone = "ink",
    icon,
    className,
}: {
    href?: string
    onClick?: () => void
    children: ReactNode
    tone?: "ink" | "outline"
    icon?: ReactNode
    className?: string
}) {
    const classes = cn(
        "inline-flex items-center justify-center gap-2 rounded-pill px-4 py-2.5 text-sm font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        tone === "ink"
            ? "bg-primary text-primary-foreground hover:bg-brand-hover"
            : "border border-border-strong bg-card text-foreground hover:bg-secondary",
        className
    )

    if (href) {
        return (
            <Link href={href} className={classes}>
                {icon}
                {children}
            </Link>
        )
    }
    return (
        <button type="button" onClick={onClick} className={classes}>
            {icon}
            {children}
        </button>
    )
}

/** A labelled figure. The label is small and quiet; the number carries. */
export function Stat({
    label,
    value,
    tone = "neutral",
    hint,
}: {
    label: string
    value: string
    tone?: "neutral" | "positive" | "negative"
    hint?: string
}) {
    return (
        <div className="flex flex-col gap-1">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p
                className={cn(
                    "figure text-2xl font-semibold",
                    tone === "positive" && "text-positive",
                    tone === "negative" && "text-negative",
                    tone === "neutral" && "text-foreground"
                )}
            >
                {value}
            </p>
            {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
        </div>
    )
}

/**
 * The segmented control — one choice from a short, visible set.
 *
 * This markup was hand-copied into eight screens (budget type, chart range,
 * billing interval, appearance, order side, portfolio view…), each with its own
 * slightly different padding and font size. Same control, eight spellings,
 * eight chances to drift. One implementation instead.
 *
 * It is a radiogroup rather than a row of buttons: arrow keys move between
 * options natively, and a screen reader announces "2 of 3" instead of reading
 * three unrelated buttons.
 */
export function SegmentedControl<T extends string>({
    value,
    onChange,
    options,
    label,
    size = "md",
    className,
}: {
    value: T
    onChange: (next: T) => void
    options: { value: T; label: ReactNode }[]
    /** Names the group for assistive tech; visually hidden. */
    label: string
    size?: "sm" | "md"
    className?: string
}) {
    return (
        <div
            role="radiogroup"
            aria-label={label}
            className={cn("inline-flex rounded-pill bg-secondary p-[3px]", className)}
        >
            {options.map((option) => {
                const selected = option.value === value
                return (
                    <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => onChange(option.value)}
                        className={cn(
                            "rounded-pill font-medium transition-colors",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                            size === "sm" ? "px-3 py-1 text-xs" : "px-3.5 py-1.5 text-sm",
                            selected
                                ? "bg-card text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        {option.label}
                    </button>
                )
            })}
        </div>
    )
}
