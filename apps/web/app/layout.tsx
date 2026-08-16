import type { Metadata } from "next"
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google"
import "./globals.css"
import { SiteFooter, SiteNav } from "@/components/site"

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

const siteUrl = "https://www.finnacalc.com"

export const metadata: Metadata = {
    metadataBase: new URL(siteUrl),
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
        url: siteUrl,
        siteName: "FinnaCalc",
        type: "website",
    },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="en" className={`${ibmPlexSans.variable} ${ibmPlexMono.variable}`}>
            <body className="font-sans antialiased">
                <div className="flex min-h-screen flex-col">
                    <SiteNav />
                    <main className="flex-1">{children}</main>
                    <SiteFooter />
                </div>
            </body>
        </html>
    )
}
