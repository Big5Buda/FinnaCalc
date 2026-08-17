import { type Metadata } from 'next'
import { DM_Sans, Source_Serif_4 } from 'next/font/google'
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

/*
 * The marketing site's pair, by role: the sans carries the interface, the
 * serif carries brand moments. Stand-ins for The Future and Tiempos Text,
 * which the user intends to license — swapping them is this block alone.
 */
const sans = DM_Sans({
    variable: '--font-sans',
    subsets: ['latin'],
    weight: 'variable',
})
const serif = Source_Serif_4({
    variable: '--font-serif',
    subsets: ['latin'],
    weight: 'variable',
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
        <html lang="en" className={`${sans.variable} ${serif.variable}`} suppressHydrationWarning>
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
