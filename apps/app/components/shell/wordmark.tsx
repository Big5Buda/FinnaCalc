import { cn } from "@/lib/utils"

/** The FinnaCalc wordmark — "Finna" in ink, "Calc" in cobalt (FCWordmark). */
export function Wordmark({ className }: { className?: string }) {
    return (
        <span className={cn("font-bold tracking-tight text-foreground", className)}>
            Finna<span className="text-primary">Calc</span>
        </span>
    )
}
