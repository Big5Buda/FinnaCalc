"use client"

import type { ButtonHTMLAttributes, ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * The FC* design-system pieces, ported from Core/DesignSystem in the iOS app:
 * card, card header/title/description/content, button, badge, icon chip and
 * the section label. Same tokens, same radii, same weights.
 */

export function Card({ className, children }: { className?: string; children: ReactNode }) {
    return (
        <div className={cn("rounded-lg border border-border bg-card shadow-sm", className)}>{children}</div>
    )
}

export function CardHeader({ className, children }: { className?: string; children: ReactNode }) {
    return <div className={cn("flex flex-col gap-1.5 p-6 pb-4", className)}>{children}</div>
}

export function CardTitle({ className, children }: { className?: string; children: ReactNode }) {
    return (
        <h2 className={cn("text-2xl font-semibold tracking-tight text-card-foreground", className)}>
            {children}
        </h2>
    )
}

export function CardDescription({ className, children }: { className?: string; children: ReactNode }) {
    return <p className={cn("text-sm text-muted-foreground", className)}>{children}</p>
}

export function CardContent({ className, children }: { className?: string; children: ReactNode }) {
    return <div className={cn("p-6 pt-0", className)}>{children}</div>
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "default" | "outline" | "ghost" | "destructive"
    size?: "sm" | "md" | "lg"
}

export function Button({ variant = "default", size = "md", className, ...props }: ButtonProps) {
    return (
        <button
            {...props}
            className={cn(
                "inline-flex items-center justify-center gap-2 rounded-md font-semibold transition",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                "disabled:pointer-events-none disabled:opacity-50",
                size === "sm" && "h-9 px-3 text-sm",
                size === "md" && "h-10 px-4 text-sm",
                size === "lg" && "h-12 px-6 text-base",
                variant === "default" && "bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-press",
                variant === "outline" && "border border-border bg-background text-foreground hover:bg-secondary",
                variant === "ghost" && "text-foreground hover:bg-secondary",
                variant === "destructive" && "bg-destructive text-destructive-foreground hover:opacity-90",
                className
            )}
        />
    )
}

export function Badge({
    children,
    variant = "default",
    dot = false,
    className,
}: {
    children: ReactNode
    variant?: "default" | "secondary" | "positive"
    dot?: boolean
    className?: string
}) {
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold",
                variant === "default" && "bg-primary text-primary-foreground",
                variant === "secondary" && "bg-secondary text-foreground",
                variant === "positive" && "bg-positive/14 text-positive",
                className
            )}
        >
            {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
            {children}
        </span>
    )
}

/** Brand-tinted rounded chip behind an icon (FCIconChip). */
export function IconChip({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <span
            className={cn(
                "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/14 text-primary",
                className
            )}
        >
            {children}
        </span>
    )
}

/** The all-caps, tracked section label used across Home, Budgeting and Account. */
export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <p className={cn("text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground", className)}>
            {children}
        </p>
    )
}

/** Inline error/notice boxes shared by the auth, plans and account screens. */
export function Notice({
    tone = "error",
    children,
}: {
    tone?: "error" | "caution" | "info"
    children: ReactNode
}) {
    return (
        <div
            className={cn(
                "rounded-md p-3 text-sm",
                tone === "error" && "bg-negative/10 text-negative",
                tone === "caution" && "bg-caution/12 text-foreground",
                tone === "info" && "bg-primary/10 text-foreground"
            )}
        >
            {children}
        </div>
    )
}
