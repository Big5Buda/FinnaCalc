import { type Metadata } from 'next'
import { IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { AppearanceProvider, APPEARANCE_KEY } from '@/components/providers/appearance-provider'
import { AuthProvider } from '@/components/providers/auth-provider'
import { ChatProvider } from '@/components/providers/chat-provider'
import { BudgetProvider } from '@/components/providers/budget-provider'
import { WatchlistProvider } from '@/components/providers/watchlist-provider'
import { SiteChrome } from '@/components/shell/site-chrome'
import { FinnaBotPanel } from '@/components/shell/finnabot-panel'

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
    title: {
        default: 'FinnaCalc — Your All In One Personal Finance Platform',
        template: '%s — FinnaCalc',
    },
    description:
        'Free financial calculators, plain-language money lessons, and an AI helper that actually answers. Budgeting, investing, and taxes live in the FinnaCalc iOS app.',
    openGraph: {
        title: 'FinnaCalc — Your All In One Personal Finance Platform',
        description:
            'Free financial calculators, money lessons, and an AI helper that actually answers.',
        url: siteUrl,
        siteName: 'FinnaCalc',
        images: [{ url: '/finnacalc-logo.png', width: 1200, height: 630, alt: 'FinnaCalc' }],
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'FinnaCalc — Your All In One Personal Finance Platform',
        description: 'Free financial calculators, money lessons, and an AI helper that actually answers.',
        images: ['/finnacalc-logo.png'],
    },
}

/**
 * Applies the stored System/Light/Dark choice before first paint, so the page
 * never flashes the wrong scheme on load.
 */
const appearanceScript = `
try {
  var stored = localStorage.getItem('${APPEARANCE_KEY}');
  var dark = stored === 'dark' || ((!stored || stored === 'system') && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
} catch (e) {}
`

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="en" className={`${ibmPlexSans.variable} ${ibmPlexMono.variable}`} suppressHydrationWarning>
            <head>
                <script dangerouslySetInnerHTML={{ __html: appearanceScript }} />
            </head>
            <body className="font-sans antialiased bg-background text-foreground">
                <AppearanceProvider>
                    <AuthProvider>
                        <BudgetProvider>
                          <WatchlistProvider>
                            <ChatProvider>
                                <SiteChrome>{children}</SiteChrome>
                                <FinnaBotPanel />
                            </ChatProvider>
                          </WatchlistProvider>
                        </BudgetProvider>
                    </AuthProvider>
                </AppearanceProvider>
                <Analytics />
                <SpeedInsights />
            </body>
        </html>
    )
}
