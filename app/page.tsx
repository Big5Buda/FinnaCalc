import Image from "next/image"
import {
    Apple,
    Wallet,
    LineChart,
    FileText,
    Sparkles,
    ShieldCheck,
    Lock,
    EyeOff,
    Check,
    type LucideIcon,
} from "lucide-react"
import { Phone } from "@/components/marketing/phone"
import { WaitlistForm } from "@/components/marketing/waitlist-form"
import { WaitlistCount } from "@/components/marketing/waitlist-count"

function Wordmark({ className = "" }: { className?: string }) {
    return (
        <span className={`font-bold tracking-tight ${className}`}>
            Finna<span className="text-primary">Calc</span>
        </span>
    )
}

function Nav() {
    return (
        <header className="sticky top-0 z-50 border-b border-border/60 bg-white/80 backdrop-blur">
            <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
                <Wordmark className="text-xl" />
                <div className="flex items-center gap-6">
                    <a href="#features" className="hidden text-sm font-medium text-muted-foreground transition hover:text-foreground sm:block">
                        Features
                    </a>
                    <a href="#privacy" className="hidden text-sm font-medium text-muted-foreground transition hover:text-foreground sm:block">
                        Privacy
                    </a>
                    <a
                        href="#waitlist"
                        className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
                    >
                        Join the waitlist
                    </a>
                </div>
            </nav>
        </header>
    )
}

function Hero() {
    return (
        <section className="relative overflow-hidden">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-primary/5 to-transparent" />
            <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 lg:grid-cols-2 lg:py-28">
                <div className="flex flex-col items-start gap-6">
                    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-sm font-medium text-muted-foreground">
                        <Apple className="h-4 w-4" /> Coming soon to iOS
                    </span>
                    <h1 className="text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
                        Your whole financial life, in one app.
                    </h1>
                    <p className="max-w-md text-lg text-muted-foreground">
                        Budgeting, investing, and taxes — with an AI that actually helps. FinnaCalc puts every
                        money decision in one place.
                    </p>
                    <div id="waitlist-hero" className="flex w-full flex-col gap-3">
                        <WaitlistForm referralSource="hero" />
                        <WaitlistCount />
                        <p className="text-xs text-muted-foreground">No spam. One email when we launch.</p>
                    </div>
                </div>
                <div className="flex justify-center lg:justify-end">
                    <Phone src="/screenshots/home.png" alt="FinnaCalc home screen" priority />
                </div>
            </div>
        </section>
    )
}

function TrustStrip() {
    const items = [
        { icon: Lock, label: "Bank-level encryption" },
        { icon: EyeOff, label: "Read-only access via Plaid" },
        { icon: ShieldCheck, label: "We never sell your data" },
    ]
    return (
        <section className="border-y border-border bg-secondary/40">
            <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-4 px-6 py-6 sm:flex-row sm:gap-10">
                {items.map(({ icon: Icon, label }) => (
                    <div key={label} className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <Icon className="h-4 w-4 text-primary" />
                        {label}
                    </div>
                ))}
            </div>
        </section>
    )
}

function Feature({
    icon: Icon,
    eyebrow,
    title,
    body,
    bullets,
    screenshot,
    alt,
    reverse = false,
}: {
    icon: LucideIcon
    eyebrow: string
    title: string
    body: string
    bullets?: string[]
    screenshot: string
    alt: string
    reverse?: boolean
}) {
    return (
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-16 lg:grid-cols-2 lg:py-24">
            <div className={`flex flex-col items-start gap-5 ${reverse ? "lg:order-2" : ""}`}>
                <span className="inline-flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                    <Icon className="h-4 w-4" /> {eyebrow}
                </span>
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
                <p className="max-w-md text-lg text-muted-foreground">{body}</p>
                {bullets && (
                    <ul className="flex flex-col gap-3">
                        {bullets.map((b) => (
                            <li key={b} className="flex items-start gap-3 text-base text-foreground">
                                <Check className="mt-1 h-5 w-5 shrink-0 text-primary" />
                                {b}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            <div className={`flex justify-center ${reverse ? "lg:order-1 lg:justify-start" : "lg:justify-end"}`}>
                <Phone src={screenshot} alt={alt} />
            </div>
        </div>
    )
}

function Features() {
    return (
        <section id="features">
            <Feature
                icon={Wallet}
                eyebrow="Budgeting"
                title="Budgeting that keeps up with you."
                body="Build a budget in minutes, track every category, and get an AI advisor that spots where your money actually goes — and what to do about it."
                screenshot="/screenshots/budgeting.png"
                alt="FinnaCalc budgeting screen"
            />
            <Feature
                icon={LineChart}
                eyebrow="Investing"
                title="Markets, portfolio, and research in one place."
                body="Follow live markets, track your holdings, screen stocks, and trade — all inside the app. Real quotes, real research, no tab-hopping."
                screenshot="/screenshots/investing.png"
                alt="FinnaCalc investing screen"
                reverse
            />
            <Feature
                icon={FileText}
                eyebrow="Taxes"
                title="File your taxes. No forms, no jargon."
                body="Answer simple questions and watch your refund update in real time."
                bullets={[
                    "IRS-accurate engine — the real 1040 math",
                    "Live refund tracker as you answer",
                    "Sensitive info never leaves your device unencrypted",
                ]}
                screenshot="/screenshots/taxes.png"
                alt="FinnaCalc taxes screen"
            />
        </section>
    )
}

function Finnabot() {
    return (
        <section className="border-y border-border bg-secondary/40">
            <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-6 py-20 text-center">
                <Image
                    src="/finnabot-logo.png"
                    alt="Finnabot"
                    width={96}
                    height={96}
                    className="h-24 w-24 object-contain"
                />
                <span className="inline-flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                    <Sparkles className="h-4 w-4" /> Meet Finnabot
                </span>
                <h2 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
                    An AI that actually helps with your money.
                </h2>
                <p className="max-w-xl text-lg text-muted-foreground">
                    Ask anything — “Can I afford this?”, “How’s my portfolio?”, “What lowers my taxes?” Finnabot
                    knows your full picture and answers in plain language, right where you are.
                </p>
            </div>
        </section>
    )
}

function Privacy() {
    const cols = [
        {
            icon: Lock,
            title: "Encrypted end to end",
            body: "Bank-level encryption everywhere. Sensitive tax info never leaves your device unencrypted.",
        },
        {
            icon: EyeOff,
            title: "Read-only by default",
            body: "Accounts connect read-only through Plaid. FinnaCalc can see balances — never move your money without you.",
        },
        {
            icon: ShieldCheck,
            title: "Never sold",
            body: "We make money from a subscription, never from selling your data. Your finances are yours.",
        },
    ]
    return (
        <section id="privacy" className="mx-auto max-w-6xl px-6 py-24">
            <div className="mx-auto mb-14 max-w-2xl text-center">
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Your money stays yours.</h2>
                <p className="mt-4 text-lg text-muted-foreground">
                    Real finance means real trust. Here’s exactly how we handle your data.
                </p>
            </div>
            <div className="grid gap-8 sm:grid-cols-3">
                {cols.map(({ icon: Icon, title, body }) => (
                    <div key={title} className="rounded-2xl border border-border bg-card p-6">
                        <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                            <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <h3 className="mb-2 text-lg font-semibold">{title}</h3>
                        <p className="text-muted-foreground">{body}</p>
                    </div>
                ))}
            </div>
        </section>
    )
}

function FinalCta() {
    return (
        <section id="waitlist" className="border-t border-border bg-secondary/40">
            <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-6 py-24 text-center">
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                    Be first when FinnaCalc launches.
                </h2>
                <p className="max-w-xl text-lg text-muted-foreground">
                    Join the waitlist and we’ll email you the moment FinnaCalc lands on the App Store.
                </p>
                <div className="flex w-full flex-col items-center gap-3">
                    <div className="flex w-full justify-center">
                        <WaitlistForm referralSource="footer-cta" buttonLabel="Get early access" />
                    </div>
                    <WaitlistCount />
                </div>
            </div>
        </section>
    )
}

function Footer() {
    return (
        <footer className="border-t border-border">
            <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 sm:flex-row">
                <Wordmark className="text-lg" />
                <p className="text-sm text-muted-foreground">© 2026 FinnaCalc. All rights reserved.</p>
                <a
                    href="mailto:hello@finnacalc.com"
                    className="text-sm font-medium text-muted-foreground transition hover:text-foreground"
                >
                    Contact
                </a>
            </div>
        </footer>
    )
}

export default function HomePage() {
    return (
        <>
            <Nav />
            <main>
                <Hero />
                <TrustStrip />
                <Features />
                <Finnabot />
                <Privacy />
                <FinalCta />
            </main>
            <Footer />
        </>
    )
}
