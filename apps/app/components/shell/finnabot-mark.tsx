import { cn } from "@/lib/utils"

/** Reuse the native app's transparent light/dark artwork without recoloring its coins. */
export function FinnaBotMark({ className }: { className?: string }) {
    return <span aria-hidden="true" className={cn("inline-flex items-center justify-center", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/finnabot-logo-light.png" alt="" width={678} height={1350} className="h-full w-full object-contain dark:hidden" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/finnabot-logo-dark.png" alt="" width={678} height={1350} className="hidden h-full w-full object-contain dark:block" />
    </span>
}
