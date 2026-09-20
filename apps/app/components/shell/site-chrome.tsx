"use client"

import { usePathname } from "next/navigation"
import type { ReactNode } from "react"
import { SiteHeader } from "@/components/shell/site-header"
import { SiteFooter } from "@/components/shell/site-footer"
import { FinnaBotButton } from "@/components/shell/finnabot-button"

/**
 * The site shell: the top header, the page, the footer, and FinnaBot in the
 * corner. This is the shape the site had from the start and the one the
 * owner asked to have back; the icon rail and the dashboard it opened onto
 * are gone.
 *
 * Sign-in, sign-up and the auth callbacks still render bare: they are the
 * doorway, and a header full of destinations is noise on a page whose only
 * job is to get you through it.
 */
const BARE_ROUTES = ["/sign-in", "/sign-up", "/auth/", "/migrate"]

export function SiteChrome({ children }: { children: ReactNode }) {
    const pathname = usePathname()
    const bare = BARE_ROUTES.some((route) => pathname === route || pathname.startsWith(route))

    if (bare) return <>{children}</>

    return (
        <div className="flex min-h-screen flex-col bg-background">
            <SiteHeader />
            <main className="flex-1">{children}</main>
            <SiteFooter />
            <FinnaBotButton />
        </div>
    )
}
