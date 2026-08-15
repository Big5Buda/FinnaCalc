import type { Metadata } from "next"
import {
    Award,
    BarChart3,
    BookOpen,
    Briefcase,
    FileText,
    Heart,
    MessageSquare,
    PieChart,
    Shield,
    Sigma,
    Target,
    TrendingUp,
    Users,
    type LucideIcon,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives"

export const metadata: Metadata = {
    title: "About",
    description:
        "One app for your whole financial life: budgeting with your bank connected, investing with your brokerage connected, a real tax estimator, lessons that explain it, and the calculators FinnaCalc started with.",
}

const OFFER: { icon: LucideIcon; tint: string; title: string; body: string }[] = [
    {
        icon: PieChart,
        tint: "text-positive",
        title: "Budgeting",
        body: "Budgets you build by hand or connect to your bank, with goals, bill reminders, spending analysis, and history across every month.",
    },
    {
        icon: TrendingUp,
        tint: "text-primary",
        title: "Investing",
        body: "Connect a brokerage to see your live portfolio, place orders where your brokerage allows it, follow markets and news, and dig into ten years of company financials.",
    },
    {
        icon: FileText,
        tint: "text-accent-purple",
        title: "Taxes",
        body: "A federal tax estimator built on the real 1040 math and updated for the current tax year, plus planning calculators. It is an estimate to check against your filing service, not a filing.",
    },
    {
        icon: BookOpen,
        tint: "text-accent-orange",
        title: "Education",
        body: "Short lessons on money, investing, and taxes, so the numbers in the app always come with a way to understand them.",
    },
    {
        icon: MessageSquare,
        tint: "text-negative",
        title: "FinnaBot and analysis",
        body: "An AI helper that reads the numbers you choose to share and answers in everyday words, from budget checkups to portfolio questions.",
    },
    {
        icon: Sigma,
        tint: "text-positive",
        title: "Calculators",
        body: "The full set that started FinnaCalc: loans, savings, retirement, startup costs, break-even, ROI, and more, free to use.",
    },
]

const VALUES: { icon: LucideIcon; tint: string; title: string; body: string }[] = [
    {
        icon: Shield,
        tint: "text-primary",
        title: "Accuracy",
        body: "Every calculation is thoroughly tested and based on current financial standards and regulations.",
    },
    {
        icon: Heart,
        tint: "text-positive",
        title: "Accessibility",
        body: "Financial planning tools should be available to everyone, regardless of their economic background.",
    },
    {
        icon: Users,
        tint: "text-accent-purple",
        title: "Simplicity",
        body: "Complex financial concepts made simple and understandable for users of all experience levels.",
    },
    {
        icon: Award,
        tint: "text-accent-orange",
        title: "Excellence",
        body: "Continuous improvement and innovation to provide the best possible user experience.",
    },
]

const REASONS = [
    {
        title: "Free at the Core",
        body: "Budgets, goals, calculators, lessons, market research, and the tax estimator are free. Paid plans add automation and deeper analysis on top.",
    },
    {
        title: "Honest Numbers",
        body: "Every figure comes from your own data or a live source. When something is not known yet, you see a dash and a reason, not a filler number.",
    },
    {
        title: "Explained, Not Just Shown",
        body: "Every stat, chart, and tax line comes with a short explanation of what it means and why it matters.",
    },
    {
        title: "Your Judgment Matters",
        body: "FinnaCalc is a tool, not an advisor. We can get things wrong, markets move, and no two tax situations match, so check what matters before you act on it.",
    },
]

export default function AboutPage() {
    return (
        <div className="bg-muted/40">
            <div className="mx-auto flex max-w-3xl flex-col gap-12 px-4 py-10">
                <section className="flex flex-col items-center gap-4 text-center">
                    <h1 className="text-4xl font-bold tracking-tight text-foreground">
                        Empowering Smart Financial Decisions
                    </h1>
                    <p className="text-xl text-muted-foreground">
                        One app for your whole financial life: budgeting with your bank connected, investing
                        with your brokerage connected, a real tax estimator, lessons that explain it, and the
                        calculators FinnaCalc started with.
                    </p>
                </section>

                <section className="flex flex-col gap-6">
                    <StatementCard
                        icon={Target}
                        tint="text-primary"
                        title="Our Mission"
                        body="To put honest money tools in everyone's pocket. Budgeting, investing, taxes, and lessons in one app, showing real numbers and never inventing one, whatever your background or experience."
                    />
                    <StatementCard
                        icon={Heart}
                        tint="text-negative"
                        title="Our Vision"
                        body="To be the most trusted place to see your whole financial life in one honest picture, and to help millions of people make informed decisions with it."
                    />
                </section>

                <section className="flex flex-col gap-8">
                    <div className="flex flex-col items-center gap-3 text-center">
                        <h2 className="text-3xl font-bold text-foreground">What We Offer</h2>
                        <p className="text-lg text-muted-foreground">
                            Comprehensive financial tools designed for real-world applications
                        </p>
                    </div>
                    <div className="grid gap-6 sm:grid-cols-2">
                        {OFFER.map((item) => (
                            <StatementCard key={item.title} {...item} />
                        ))}
                    </div>
                </section>

                <section className="flex flex-col gap-8">
                    <h2 className="text-center text-3xl font-bold text-foreground">Our Core Values</h2>
                    <div className="grid gap-6 sm:grid-cols-2">
                        {VALUES.map(({ icon: Icon, tint, title, body }) => (
                            <div key={title} className="flex flex-col items-center gap-3 text-center">
                                <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
                                    <Icon className={`h-8 w-8 ${tint}`} />
                                </span>
                                <p className="text-base font-semibold text-foreground">{title}</p>
                                <p className="text-sm text-muted-foreground">{body}</p>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="rounded-lg bg-background p-8 shadow-sm">
                    <div className="mb-8 flex flex-col items-center gap-4 text-center">
                        <h2 className="text-3xl font-bold text-foreground">Why Choose FinnaCalc?</h2>
                        <p className="text-lg text-muted-foreground">
                            We&rsquo;re committed to providing the most reliable and user-friendly financial
                            tools available
                        </p>
                    </div>
                    <div className="grid gap-8 sm:grid-cols-2">
                        {REASONS.map((reason) => (
                            <div key={reason.title} className="flex flex-col gap-4">
                                <h3 className="text-xl font-semibold text-foreground">{reason.title}</h3>
                                <p className="text-base text-muted-foreground">{reason.body}</p>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="flex flex-col items-center gap-4 text-center">
                    <h2 className="text-2xl font-bold text-foreground">Get in Touch</h2>
                    <p className="text-base text-muted-foreground">
                        Have questions, suggestions, or feedback? We&rsquo;d love to hear from you. Our team is
                        committed to continuously improving FinnaCalc based on user needs and feedback.
                    </p>
                    <div className="flex flex-col gap-2">
                        <ContactLine label="Help:" email="helpfinnacalc@gmail.com" />
                        <ContactLine label="Business Inquiries:" email="finnacalc@gmail.com" />
                    </div>
                </section>
            </div>
        </div>
    )
}

function StatementCard({
    icon: Icon,
    tint,
    title,
    body,
}: {
    icon: LucideIcon
    tint: string
    title: string
    body: string
}) {
    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-2">
                    <Icon className={`h-6 w-6 ${tint}`} />
                    <CardTitle>{title}</CardTitle>
                </div>
            </CardHeader>
            <CardContent>
                <p className="text-base text-muted-foreground">{body}</p>
            </CardContent>
        </Card>
    )
}

function ContactLine({ label, email }: { label: string; email: string }) {
    return (
        <p className="text-base text-muted-foreground">
            <strong className="font-bold">{label}</strong>{" "}
            <a href={`mailto:${email}`} className="text-primary">
                {email}
            </a>
        </p>
    )
}
