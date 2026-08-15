import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * The section-page header, in the marketing layout language: a small tracked
 * eyebrow, an oversized display title, and a lead line that stops well short of
 * the measure. Used by the hub pages so a section opens with the same rhythm
 * the landing set, without touching the data views underneath it.
 */
export function PageHeader({
    eyebrow,
    title,
    lead,
    actions,
    className,
}: {
    eyebrow?: string
    title: string
    lead?: string
    actions?: ReactNode
    className?: string
}) {
    return (
        <header className={cn("flex flex-col gap-4 pb-2 pt-4", className)}>
            {eyebrow && (
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                    {eyebrow}
                </p>
            )}
            <div className="flex flex-wrap items-end justify-between gap-4">
                <h1 className="text-[clamp(2.25rem,5vw,3.5rem)] font-bold leading-[1.02] tracking-[-0.03em] text-foreground">
                    {title}
                </h1>
                {actions}
            </div>
            {lead && <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">{lead}</p>}
        </header>
    )
}
