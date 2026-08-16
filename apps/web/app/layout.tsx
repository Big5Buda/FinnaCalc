import type { Metadata } from "next"
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google"
import "./globals.css"
import { SiteFooter, SiteNav } from "@/components/site"
import { DataHandoffBanner } from "@/components/data-handoff"
import { SITE_ORIGIN } from "@/lib/app-url"

/*
 * The marketing site: un-gated, public, and the only origin a visitor meets
 * before they have an account. It shares the app's typefaces and tokens so the
 * handoff to app.finnacalc.com doesn't feel like a different product.
 */
const ibmPlexSans = IBM_Plex_Sans({
    variable: "--font-ibm-plex-sans",
    subsets: ["latin"],
    weight: ["400", "500", "600", "700"],
})
const ibmPlexMono = IBM_Plex_Mono({
    variable: "--font-ibm-plex-mono",
    subsets: ["latin"],
    weight: ["400", "500", "600"],
})

export const metadata: Metadata = {
    metadataBase: new URL(SITE_ORIGIN),
    title: {
        default: "FinnaCalc — Real-time financial modelling and calculation",
        template: "%s — FinnaCalc",
    },
    description:
        "Model savings, loans and retirement in real time, budget with your bank connected, and follow your own portfolio. Free to use, no account needed to start.",
    openGraph: {
        title: "FinnaCalc — Real-time financial modelling and calculation",
        description:
            "Model savings, loans and retirement in real time. Free to use, no account needed to start.",
        url: SITE_ORIGIN,
        siteName: "FinnaCalc",
        type: "website",
    },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="en" className={`${ibmPlexSans.variable} ${ibmPlexMono.variable}`}>
            <body className="font-sans antialiased">
                <div className="flex min-h-screen flex-col">
                    <DataHandoffBanner />
                    <SiteNav />
                    <main className="flex-1">{children}</main>
                    <SiteFooter />
                </div>
            </body>
        </html>
    )
}
