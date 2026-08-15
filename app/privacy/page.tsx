import type { Metadata } from "next"
import { Database, Eye, FileText, Lock, Shield, Users, type LucideIcon } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives"

export const metadata: Metadata = {
    title: "Privacy Policy",
    description:
        "How FinnaCalc collects, uses, shares, and protects your information across the app and this site.",
}

export default function PrivacyPage() {
    return (
        <div className="bg-muted/40">
            <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-10">
                <h1 className="text-center text-4xl font-bold text-foreground">Privacy Policy</h1>

                <Section icon={Eye} tint="text-primary" title="Introduction">
                    <P>
                        Your privacy matters to us. This Privacy Policy explains how we collect, use, share, and
                        protect your information when you use FinnaCalc, including its calculators, budgeting
                        tools, investing research, guided tax estimator, education content, and the FinnaBot
                        assistant.
                    </P>
                    <P>
                        By using FinnaCalc, you agree to how we collect and use information under this policy.
                        If you don&rsquo;t agree with it, please don&rsquo;t use it.
                    </P>
                </Section>

                <Section icon={Database} tint="text-positive" title="Information Collected">
                    <Sub>Information You Provide</Sub>
                    <Bullets
                        items={[
                            "Optional account details (name, email) if you sign up, stored with our authentication provider (Supabase)",
                            "Calculator, budgeting, and tax-estimator inputs, which are saved on your device, not on our servers",
                            "Bank statements you import, which are parsed and stored only on your device",
                            "Messages you send to FinnaBot and the Budget Analysis assistant",
                            "Contact information and feedback when you reach out",
                        ]}
                    />
                    <Sub>Automatically Collected Information</Sub>
                    <Bullets
                        items={[
                            "The stock symbols and market pages you request (needed to fetch quotes, charts, and news)",
                            "Basic server logs (IP address, timestamps) when the app talks to our services",
                            "Device information such as OS version",
                        ]}
                    />
                    <Sub>Bank &amp; Brokerage Connections</Sub>
                    <Bullets
                        items={[
                            "Bank and brokerage links run through Plaid and SnapTrade. Your bank credentials go to them directly and never touch FinnaCalc's servers",
                            "Imported transactions and holdings are stored on your device",
                        ]}
                    />
                    <Callout tone="info">
                        <strong className="font-bold">Important:</strong> Your budget, goals, history, and
                        tax-estimator answers live on your device. Sensitive tax fields (Social Security
                        numbers, bank details) are never saved, and the tax estimator does not transmit your
                        return, since e-filing isn&rsquo;t enabled yet.
                    </Callout>
                </Section>

                <Section icon={Users} tint="text-accent-purple" title="How Information Is Used">
                    <LeadBullets
                        items={[
                            ["Service Provision:", "To provide calculators, budgeting, market data, tax estimation, and the AI assistant"],
                            ["Personalization:", "To answer FinnaBot and Budget Analysis questions using the budget snapshot you share in that conversation"],
                            ["Improvement:", "To understand usage and improve the app"],
                            ["Communication:", "To respond to inquiries and provide support"],
                            ["Security:", "To detect, prevent, and address technical issues and security threats"],
                            ["Legal Compliance:", "To comply with applicable laws and regulations"],
                        ]}
                    />
                </Section>

                <Section icon={Lock} tint="text-negative" title="Information Sharing and Disclosure">
                    <P>
                        Personal information is not sold, traded, or otherwise transferred to third parties
                        except in the following circumstances:
                    </P>
                    <LeadBullets
                        items={[
                            ["Service Providers:", "Supabase (accounts), Plaid and SnapTrade (bank/brokerage links, under their own privacy policies), Google (AI responses for FinnaBot), and market-data providers that receive the ticker symbols you view"],
                            ["Purchases:", "Payment is handled by whichever processor you subscribe through, Apple for in-app purchases or Stripe on our website. They hold your card details; FinnaCalc only learns which plan is active"],
                            ["Legal Requirements:", "When required by law or to protect rights and safety"],
                            ["Business Transfers:", "In connection with a merger, acquisition, or sale of assets"],
                            ["Consent:", "When you have given explicit consent for sharing"],
                        ]}
                    />
                </Section>

                <Section icon={Shield} tint="text-accent-orange" title="Data Security">
                    <P>
                        We use sensible technical and organizational safeguards to protect your information
                        from unauthorized access, alteration, disclosure, or loss.
                    </P>
                    <Bullets
                        items={[
                            "Personal finance data (budget, goals, tax answers) stays on your device",
                            "SSL/TLS encryption for everything sent to our services",
                            "Bank credentials handled only by Plaid and SnapTrade, never by FinnaCalc",
                            "Limited access to personal information on a need-to-know basis",
                            "Secure hosting infrastructure",
                        ]}
                    />
                    <Callout tone="caution">
                        <strong className="font-bold">Note:</strong> While efforts are made to protect your
                        information, no method of transmission over the internet or electronic storage is 100%
                        secure. Absolute security cannot be guaranteed.
                    </Callout>
                </Section>

                <Section title="On-Device Storage & Preferences">
                    <P>
                        The app stores your working data and preferences locally on your device rather than
                        with tracking cookies:
                    </P>
                    <LeadBullets
                        items={[
                            ["Your data:", "Budget items, savings and investing goals, history snapshots, watchlist, and tax-estimator answers"],
                            ["Preferences:", "Appearance (light/dark), chart settings, and similar choices"],
                            ["Notifications:", "Goal alerts and bill reminders are scheduled on your device; nothing about them is sent to a server"],
                        ]}
                    />
                    <P>
                        Deleting the app removes this local data. You can also clear budgeting data from the
                        Budgeting page and restart the tax estimator at any time. The app does not use
                        advertising trackers.
                    </P>
                </Section>

                <Section title="Your Privacy Rights">
                    <P>Depending on your location, you may have the following rights:</P>
                    <LeadBullets
                        items={[
                            ["Access:", "Request information about the personal data held about you"],
                            ["Correction:", "Request correction of inaccurate or incomplete information"],
                            ["Deletion:", "Request deletion of your personal information"],
                            ["Portability:", "Request a copy of your data in a structured format"],
                            ["Objection:", "Object to certain processing of your information"],
                        ]}
                    />
                </Section>

                <Section title="Children’s Privacy">
                    <P>
                        The services are not intended for children under 13 years of age. Personal information
                        from children under 13 is not knowingly collected. If you are a parent or guardian and
                        believe your child has provided personal information, please make contact immediately.
                    </P>
                </Section>

                <Section icon={FileText} tint="text-primary" title="Changes to This Privacy Policy">
                    <P>
                        This Privacy Policy may be updated from time to time. You will be notified of any
                        changes by posting the new Privacy Policy on this page. You are advised to review this
                        Privacy Policy periodically for any changes.
                    </P>
                </Section>

                <Section title="Contact Us">
                    <P>
                        If you have any questions about this Privacy Policy or privacy practices, please make
                        contact:
                    </P>
                    <div className="flex flex-col gap-2 pt-1">
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

function Sub({ children }: { children: React.ReactNode }) {
    return <h3 className="text-lg font-semibold text-foreground">{children}</h3>
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

function LeadBullets({ items }: { items: [string, string][] }) {
    return (
        <ul className="flex list-disc flex-col gap-3 pl-5">
            {items.map(([lead, rest]) => (
                <li key={lead} className="text-base text-muted-foreground">
                    <strong className="font-bold">{lead}</strong> {rest}
                </li>
            ))}
        </ul>
    )
}

function Callout({ tone, children }: { tone: "info" | "caution"; children: React.ReactNode }) {
    return (
        <div
            className={`rounded-lg p-4 text-sm ${
                tone === "info" ? "bg-primary/10 text-foreground" : "bg-caution/12 text-foreground"
            }`}
        >
            {children}
        </div>
    )
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
