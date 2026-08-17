import type { Metadata } from "next"
import { DM_Sans, Source_Serif_4 } from "next/font/google"
import "./globals.css"
import { SiteFooter, SiteNav } from "@/components/site"
import { MotionProvider } from "@/components/motion"
import { DataHandoffBanner } from "@/components/data-handoff"
import { SITE_ORIGIN } from "@/lib/app-url"

/*
 * The marketing site: un-gated, public, and the only origin a visitor meets
 * before they have an account.
 *
 * Two faces, two jobs (see CLAUDE.md). The serif speaks for the brand — the
 * hero line, the manifesto, the footer wordmark. The sans is everything else,
 * product headlines included. Both are stand-ins for licensed faces the user
 * intends to buy (Tiempos Text for the serif, The Future for the sans); the
 * variables are named by ROLE, not by family, so the swap is: load the licensed
 * font here, keep the variable name, touch nothing else.
 */
const serif = Source_Serif_4({
    variable: "--font-serif",
    subsets: ["latin"],
    weight: "variable",
})
const sans = DM_Sans({
    variable: "--font-sans",
    subsets: ["latin"],
    weight: "variable",
})

export const metadata: Metadata = {
    metadataBase: new URL(SITE_ORIGIN),
    title: {
        default: "FinnaCalc — Money, with the math shown",
        template: "%s — FinnaCalc",
    },
    description:
        "Budget, invest and plan your taxes in one place. Free calculators, and you can always check the math. No account needed to start.",
    openGraph: {
        title: "FinnaCalc — Money, with the math shown",
        description:
            "Budget, invest and plan your taxes in one place. Free calculators, and you can always check the math.",
        url: SITE_ORIGIN,
        siteName: "FinnaCalc",
        type: "website",
    },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="en" className={`${serif.variable} ${sans.variable}`}>
            <body className="font-sans antialiased">
                <MotionProvider>
                    <div className="flex min-h-screen flex-col">
                        <DataHandoffBanner />
                        <SiteNav />
                        <main className="flex-1">{children}</main>
                        <SiteFooter />
                    </div>
                </MotionProvider>
            </body>
        </html>
    )
}
