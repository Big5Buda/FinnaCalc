"use client"

import { usePathname } from "next/navigation"
import type { ReactNode } from "react"
import { SiteHeader } from "@/components/shell/site-header"
import { SiteFooter } from "@/components/shell/site-footer"

/**
 * The site shell, minus the pages that deliberately stand alone.
 *
 * Sign-in, sign-up and the auth callbacks render full-bleed with their own
 * wordmark and bottom strip, so the nav doesn't compete with the form. They opt
 * out here rather than through a route group: a group would mean moving every
 * other page in the app into a folder to change where two of them render.
 */
const BARE_ROUTES = ["/sign-in", "/sign-up", "/auth/"]

export function SiteChrome({ children }: { children: ReactNode }) {
    const pathname = usePathname()
    const bare = BARE_ROUTES.some((route) => pathname === route || pathname.startsWith(route))

    if (bare) return <>{children}</>

    return (
        <div className="flex min-h-screen flex-col">
            <SiteHeader />
            <main className="flex-1">{children}</main>
            <SiteFooter />
        </div>
    )
}
