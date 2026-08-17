"use client"

import { usePathname } from "next/navigation"
import type { ReactNode } from "react"
import { AppRail } from "@/components/shell/app-rail"

/**
 * The application shell: the icon rail on the left, the workspace filling the
 * rest of the window.
 *
 * The old top header and marketing footer are gone. Since #114 this app is
 * behind sign-in, so every page here belongs to someone who is already a user
 * — they need navigation between workspaces, not a site nav selling the
 * product. Marketing lives on finnacalc.com now.
 *
 * Sign-in, sign-up and the auth callbacks still render bare: they're the
 * doorway, and the rail would be navigation to places the visitor can't go
 * yet. They opt out here rather than through a route group, which would mean
 * moving every other page into a folder to change where three of them render.
 */
const BARE_ROUTES = ["/sign-in", "/sign-up", "/auth/", "/migrate"]

export function SiteChrome({ children }: { children: ReactNode }) {
    const pathname = usePathname()
    const bare = BARE_ROUTES.some((route) => pathname === route || pathname.startsWith(route))

    if (bare) return <>{children}</>

    return (
        <div className="min-h-screen bg-background">
            <AppRail />
            {/* The rail is fixed, so the workspace is inset by its width. */}
            <div className="lg:pl-[88px]">{children}</div>
        </div>
    )
}
