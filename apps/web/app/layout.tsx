import type { Metadata } from "next"
import { Bricolage_Grotesque, Fraunces, JetBrains_Mono } from "next/font/google"
import "./globals.css"
import { SiteFooter, SiteNav } from "@/components/site"
import { MotionProvider } from "@/components/motion"
import { DataHandoffBanner } from "@/components/data-handoff"
import { SITE_ORIGIN } from "@/lib/app-url"

/*
 * The marketing site: un-gated, public, and the only origin a visitor meets
 * before they have an account. It shares the app's typefaces and tokens so the
 * handoff to app.finnacalc.com doesn't feel like a different product.
 */
/*
 * Three faces, three jobs (see CLAUDE.md). Fraunces carries display type,
 * Bricolage Grotesque everything read as interface or prose, JetBrains Mono
 * every figure. All three ship the full weight range the system leans on:
 * extralight (200) against black (800) is how emphasis is made here, not
 * colour.
 */
const fraunces = Fraunces({
    variable: "--font-fraunces",
    subsets: ["latin"],
    // Variable font: the whole 100–900 range, which is what lets extralight sit
    // against black in the same headline.
    weight: "variable",
})
const bricolage = Bricolage_Grotesque({
    variable: "--font-bricolage",
    subsets: ["latin"],
    weight: "variable",
})
const jetbrainsMono = JetBrains_Mono({
    variable: "--font-jetbrains-mono",
    subsets: ["latin"],
    weight: ["300", "400", "500", "700"],
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
        <html lang="en" className={`${fraunces.variable} ${bricolage.variable} ${jetbrainsMono.variable}`}>
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
