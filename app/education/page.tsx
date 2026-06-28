"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Search, DollarSign, TrendingUp, PieChart, Shield, FileText } from "lucide-react"
import FinancialEducationHub from "@/components/financial-education-hub"

const TOPICS = [
    {
        key: "credit",
        title: "Credit & Debt",
        icon: DollarSign,
        items: ["Understanding credit scores", "How to improve credit", "Debt payoff strategies"],
    },
    {
        key: "investing",
        title: "Investing",
        icon: TrendingUp,
        items: ["What are stocks & bonds?", "Risk vs reward explained", "Portfolio diversification"],
    },
    {
        key: "budgeting",
        title: "Budgeting",
        icon: PieChart,
        items: ["Creating a budget", "Tracking expenses", "Emergency fund planning"],
    },
    {
        key: "retirement",
        title: "Retirement",
        icon: Shield,
        items: ["401(k) vs IRA explained", "Compound interest power", "Retirement calculators"],
    },
    {
        key: "taxes",
        title: "Tax Planning",
        icon: FileText,
        items: ["Understanding tax brackets", "Deductions vs credits", "Business vs personal taxes"],
    },
]

export default function EducationPage() {
    const [activeSection, setActiveSection] = useState("")
    const [selectedTopic, setSelectedTopic] = useState("credit")
    const [query, setQuery] = useState("")

    const handleSectionClick = (section: string, topic?: string) => {
        setActiveSection(section)
        if (topic) setSelectedTopic(topic)
    }

    const handleBackToTab = () => setActiveSection("")

    if (activeSection === "financial-education") {
        return (
            <div className="min-h-screen bg-muted/40">
                <main className="container mx-auto px-4 py-8 max-w-6xl">
                    <FinancialEducationHub onBack={handleBackToTab} initialTopic={selectedTopic} />
                </main>
            </div>
        )
    }

    const q = query.trim().toLowerCase()
    const filtered = q
        ? TOPICS.filter(
              (t) =>
                  t.title.toLowerCase().includes(q) ||
                  t.items.some((i) => i.toLowerCase().includes(q)),
          )
        : TOPICS

    return (
        <div className="min-h-screen bg-muted/40">
            <main className="container mx-auto px-4 py-8 max-w-6xl">
                <section className="space-y-8">
                    <div className="text-center">
                        <h1 className="text-3xl font-bold text-primary mb-4">Build Financial Confidence</h1>
                        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                            Master personal finance fundamentals with easy-to-understand lessons, videos, and expert guidance.
                        </p>
                    </div>

                    {/* Search bar */}
                    <div className="relative max-w-xl mx-auto">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            className="pl-9"
                            placeholder="Search topics — e.g. credit, 401(k), budgeting"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                        />
                    </div>

                    {filtered.length > 0 ? (
                        <div className="grid grid-cols-4 gap-6">
                            {filtered.map((t) => {
                                const Icon = t.icon
                                return (
                                    <Card
                                        key={t.key}
                                        className="hover:shadow-lg transition-shadow cursor-pointer"
                                        onClick={() => handleSectionClick("financial-education", t.key)}
                                    >
                                        <CardHeader className="text-center pb-2">
                                            <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center mx-auto mb-2">
                                                <Icon className="h-6 w-6 text-primary-foreground" />
                                            </div>
                                            <CardTitle className="text-base">{t.title}</CardTitle>
                                        </CardHeader>
                                        <CardContent className="text-center">
                                            <ul className="space-y-1 text-sm mb-3 text-muted-foreground">
                                                {t.items.map((i) => (
                                                    <li key={i}>{i}</li>
                                                ))}
                                            </ul>
                                            <Button size="sm" className="w-full bg-transparent" variant="outline">
                                                Learn More
                                            </Button>
                                        </CardContent>
                                    </Card>
                                )
                            })}
                        </div>
                    ) : (
                        <p className="text-center text-muted-foreground py-12">
                            No topics match “{query}”.
                        </p>
                    )}
                </section>
            </main>
        </div>
    )
}
