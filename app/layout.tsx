import { type Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import dynamic from 'next/dynamic'
import Header from "@/components/header";

// Disable SSR to prevent useChat hydration mismatch (useChat generates IDs that differ server/client)
const ChatBot = dynamic(() => import('@/components/Chatbot'), { ssr: false })
import { ThemeProvider } from '@/components/theme-provider'
import { AuthProvider } from '@/lib/auth'
import { Toaster } from '@/components/ui/sonner'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
    title: 'FinnaCalc - Financial Calculators and Planning Tools',
    description: 'Free financial calculators and planning tools for small business owners and entrepreneurs.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="en" suppressHydrationWarning>
        <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <AuthProvider>
                <div className="flex flex-col min-h-screen">
                    <Header />
                    <main className="flex-grow">{children}</main>
                    <ChatBot />
                    <Toaster />
                </div>
            </AuthProvider>
            <Analytics />
            <SpeedInsights />
        </ThemeProvider>
        </body>
        </html>
    )
}
