import { type Metadata } from 'next'
import { IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'

const ibmPlexSans = IBM_Plex_Sans({
    variable: '--font-ibm-plex-sans',
    subsets: ['latin'],
    weight: ['400', '500', '600', '700'],
})
const ibmPlexMono = IBM_Plex_Mono({
    variable: '--font-ibm-plex-mono',
    subsets: ['latin'],
    weight: ['400', '500', '600'],
})

const siteUrl = 'https://www.finnacalc.com'

export const metadata: Metadata = {
    metadataBase: new URL(siteUrl),
    title: 'FinnaCalc — Your whole financial life, in one app',
    description:
        'Budgeting, investing, and taxes — with an AI that actually helps. FinnaCalc is coming to iOS. Join the waitlist for early access.',
    openGraph: {
        title: 'FinnaCalc — Your whole financial life, in one app',
        description:
            'Budgeting, investing, and taxes — with an AI that actually helps. Coming to iOS. Join the waitlist.',
        url: siteUrl,
        siteName: 'FinnaCalc',
        images: [{ url: '/finnacalc-logo.png', width: 1200, height: 630, alt: 'FinnaCalc' }],
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'FinnaCalc — Your whole financial life, in one app',
        description: 'Budgeting, investing, and taxes — with an AI that actually helps. Coming to iOS.',
        images: ['/finnacalc-logo.png'],
    },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="en" className={`${ibmPlexSans.variable} ${ibmPlexMono.variable}`}>
        <body className="font-sans antialiased bg-background text-foreground">
            {children}
            <Analytics />
            <SpeedInsights />
        </body>
        </html>
    )
}
