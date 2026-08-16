import type { Metadata } from "next"
import Link from "next/link"
import { AlertTriangle, FileText, Gavel, Shield, Users, type LucideIcon } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives"

export const metadata: Metadata = {
    title: "Terms of Service",
    description: "The terms that govern your use of FinnaCalc's website, app, and services.",
}

export default function TermsPage() {
    return (
        <div className="bg-muted/40">
            <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-10">
                <h1 className="text-center text-4xl font-bold text-foreground">Terms of Service</h1>

                <Section icon={FileText} tint="text-primary" title="Terms of Service Agreement">
                    <P>
                        These Terms of Service govern your use of FinnaCalc&rsquo;s website and services. By
                        accessing or using the services, you agree to be bound by these Terms. If you disagree
                        with any part of these terms, then you may and should not access the services.
                    </P>
                    <P>
                        The right to update these Terms at any time is reserved. Changes will be effective
                        immediately upon posting. Your continued use of the services after changes are posted
                        constitutes acceptance of the new Terms.
                    </P>
                </Section>

                <Section icon={Users} tint="text-positive" title="Description of Service">
                    <P>
                        FinnaCalc provides free financial tools for personal and business use. The services
                        include but are not limited to:
                    </P>
                    <Bullets
                        items={[
                            "Financial calculators (startup costs, break-even, ROI, loans, pricing, margins, and more)",
                            "Budgeting: income/expense tracking, savings goals with alerts, history snapshots, bank statement import, and optional bank connections via Plaid",
                            "Investing: optional brokerage connections via SnapTrade for a live portfolio view, portfolio analysis, investing goals, and, where your brokerage allows it, placing and canceling orders that execute at your brokerage",
                            "Investing research: quotes, charts, key stats, screeners, ETFs, company financials, a trade tracker, and market news from third-party data providers",
                            "A guided federal tax estimator with a live refund estimate (educational; e-filing is not yet enabled and returns are not transmitted)",
                            "FinnaBot, Budget Analysis, and Portfolio Analysis, our AI and analytics tools for finance questions",
                            "Educational videos and articles",
                            "Optional paid subscriptions: Budgeting Plus, Investing Plus, and FinnaCalc Pro",
                        ]}
                    />
                    <Callout>
                        <strong className="font-bold">Important: </strong>
                        The calculators provide estimates for planning purposes only. Results should not be
                        considered as professional financial, tax, or legal advice.
                    </Callout>
                </Section>

                <Section icon={Shield} tint="text-accent-purple" title="User Responsibilities">
                    <P>By using the services, you agree to:</P>
                    <Bullets
                        items={[
                            "Use the service only for lawful purposes and in accordance with these Terms",
                            "Provide accurate information when using the calculators",
                            "Not attempt to interfere with or disrupt the services",
                            "Not use automated systems to access the services without permission",
                            "Respect intellectual property rights",
                            "Not share or distribute malicious content",
                            "Comply with all applicable laws and regulations",
                        ]}
                    />
                </Section>

                <Section icon={AlertTriangle} tint="text-caution" title="Important Disclaimers">
                    <Subsection
                        heading="Financial Advice Disclaimer"
                        body="FinnaCalc does not provide financial, investment, tax, or legal advice. The calculators and tools are for informational and educational purposes only. Results are estimates based on the information you provide and should not be relied upon for making financial decisions without consulting qualified professionals."
                    />
                    <Subsection
                        heading="Accuracy Disclaimer"
                        body="While efforts are made for accuracy, no warranties are made about the completeness, reliability, or accuracy of the calculators or information. Financial regulations, tax laws, and market conditions change frequently, and the tools may not reflect the most current information."
                    />
                    <Subsection
                        heading="Market Data Disclaimer"
                        body="Quotes, charts, statistics, and news are supplied by third-party providers, may be delayed (typically 15 minutes or more), and may contain errors or gaps. Nothing in the app is a recommendation to buy or sell any security. FinnaCalc is not a broker-dealer and does not execute trades; any trading happens with your own brokerage under its terms."
                    />
                    <Subsection
                        heading="Investing and Trading Risk"
                        body="Investing involves risk, including the possible loss of the money you invest. Past performance, whether of a stock, a fund, or your own portfolio as shown in the app, does not predict future results. FinnaCalc cannot and does not promise any return, and cannot refund investment losses. Every order you place is your decision: you review and confirm it, your brokerage executes it under its own terms, and FinnaCalc never holds your money or securities. Some brokerages connect view-only, and what a connection allows is decided by the brokerage and can change."
                    />
                    <Subsection
                        heading="AI-Generated Content"
                        body="FinnaBot and Budget Analysis responses are generated by an AI model. They can be incomplete or wrong, and are not financial, tax, or legal advice. Verify anything important with a qualified professional."
                    />
                    <Subsection
                        heading="Tax Estimator"
                        body="The tax experience gives you an estimate for educational purposes. It isn't a filed return, and e-filing isn't enabled yet, so your return data is never sent to the IRS or anyone else. FinnaCalc is not a tax preparer or tax professional, tax situations differ, and the estimate can differ from what you actually owe or are refunded. Check anything important with a qualified tax professional before acting on it."
                    />
                    <Subsection
                        heading="We Can Be Wrong"
                        body="FinnaCalc's figures, analysis, and explanations can contain mistakes, and data feeds can be stale or wrong. Do your own research before acting on anything here. If a number matters, check it at the source: your bank, your brokerage, or a qualified professional."
                    />
                    <Subsection
                        heading="No Warranty"
                        body={`The services are provided "as is" without any warranty of any kind, either express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, or non-infringement.`}
                    />
                </Section>

                <Section icon={Gavel} tint="text-negative" title="Limitation of Liability">
                    <P>
                        To the fullest extent permitted by law, FinnaCalc shall not be liable for any indirect,
                        incidental, special, consequential, or punitive damages, including but not limited to:
                    </P>
                    <Bullets
                        items={[
                            "Financial losses resulting from use of the calculators, estimates, or analysis",
                            "Investment or trading losses, including orders placed through a connected brokerage",
                            "Business interruption or loss of profits",
                            "Data loss or corruption",
                            "Third-party claims or damages, including those arising from connected banks, brokerages, or data providers",
                        ]}
                    />
                    <P>
                        Total liability for any claims arising from your use of the services shall not exceed
                        the amount paid for the services (which is $0 for free services).
                    </P>
                </Section>

                <Section title="Subscriptions and Billing">
                    <P>
                        Paid plans (Budgeting Plus, Investing Plus, FinnaCalc Pro) are auto-renewing
                        subscriptions. Depending on where you subscribe, payment is processed by Apple as an
                        in-app purchase or by our payment processor on finnacalc.com. They renew until you
                        cancel, and you cancel in the same place you bought: your device settings for in-app
                        purchases, or your account on the website. Canceling stops the next renewal and keeps
                        the plan running through the period you already paid for.
                    </P>
                    <Bullets
                        items={[
                            "Prices are shown before you subscribe. If a price changes, you are told and asked before the new one is charged",
                            "Plans that include bank connections cover 2 connected bank logins per account; each additional login is $2 per month",
                            "Ad-free applies to the pages the plan covers; FinnaCalc Pro removes ads everywhere",
                            "Refunds follow the policies of whoever processed the payment: Apple for in-app purchases, or ours for purchases made on the website",
                        ]}
                    />
                </Section>

                <Section title="Intellectual Property Rights">
                    <P>
                        The FinnaCalc website, including its content, features, and functionality, is owned by
                        FinnaCalc and is protected by copyright, trademark, and other intellectual property
                        laws.
                    </P>
                    <P>You may use the services for personal and business purposes, but you may not:</P>
                    <Bullets
                        items={[
                            "Copy, modify, or distribute content without permission",
                            "Use trademarks or branding without authorization",
                            "Create derivative works based on the services",
                            "Reverse engineer or attempt to extract source code",
                        ]}
                    />
                </Section>

                <Section title="Privacy and Data Protection">
                    <P>
                        Your privacy is important. The collection and use of personal information is governed
                        by the{" "}
                        <Link href="/privacy" className="text-primary">
                            Privacy Policy
                        </Link>
                        , which is incorporated into these Terms by reference. By using the services, you
                        consent to the collection and use of information as described in the Privacy Policy.
                    </P>
                </Section>

                <Section title="Termination">
                    <P>
                        Access to the services may be terminated or suspended immediately, without prior notice
                        or liability, for any reason, including breach of these Terms. Upon termination, your
                        right to use the services will cease immediately.
                    </P>
                </Section>

                <Section title="Governing Law and Jurisdiction">
                    <P>
                        These Terms shall be governed by and construed in accordance with the laws of the
                        United States, without regard to conflict of law principles. Any disputes arising from
                        these Terms or your use of the services shall be resolved through binding arbitration
                        or in the courts of competent jurisdiction.
                    </P>
                </Section>

                <Section title="Severability and Entire Agreement">
                    <P>
                        If any provision of these Terms is held to be invalid or unenforceable, the remaining
                        provisions will remain in full force and effect.
                    </P>
                    <P>
                        These Terms, together with the Privacy Policy, constitute the entire agreement between
                        you and FinnaCalc regarding your use of the services.
                    </P>
                </Section>

                <Section title="Contact Information">
                    <P>If you have any questions about these Terms of Service, please make contact:</P>
                    <div className="flex flex-col gap-2">
                        <Contact label="Help:" email="helpfinnacalc@gmail.com" />
                        <Contact label="Inquiries:" email="finnacalc@gmail.com" />
                    </div>
                </Section>
            </div>
        </div>
    )
}

function Section({
    icon: Icon,
    tint,
    title,
    children,
}: {
    icon?: LucideIcon
    tint?: string
    title: string
    children: React.ReactNode
}) {
    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-2">
                    {Icon && <Icon className={`h-6 w-6 ${tint ?? "text-foreground"}`} />}
                    <CardTitle>{title}</CardTitle>
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col gap-4">{children}</div>
            </CardContent>
        </Card>
    )
}

function P({ children }: { children: React.ReactNode }) {
    return <p className="text-base text-muted-foreground">{children}</p>
}

function Bullets({ items }: { items: string[] }) {
    return (
        <ul className="flex list-disc flex-col gap-2 pl-5">
            {items.map((item) => (
                <li key={item} className="text-base text-muted-foreground">
                    {item}
                </li>
            ))}
        </ul>
    )
}

function Subsection({ heading, body }: { heading: string; body: string }) {
    return (
        <div className="flex flex-col gap-3">
            <h3 className="text-lg font-semibold text-foreground">{heading}</h3>
            <P>{body}</P>
        </div>
    )
}

function Callout({ children }: { children: React.ReactNode }) {
    return <div className="rounded-lg bg-primary/10 p-4 text-sm text-foreground">{children}</div>
}

function Contact({ label, email }: { label: string; email: string }) {
    return (
        <p className="text-base text-muted-foreground">
            <strong className="font-bold">{label}</strong>{" "}
            <a href={`mailto:${email}`} className="text-primary">
                {email}
            </a>
        </p>
    )
}
