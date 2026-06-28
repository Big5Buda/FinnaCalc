"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Search, Play, BookOpen, DollarSign, TrendingUp, PieChart, Shield, FileText } from "lucide-react"
import FinancialEducationHub from "@/components/financial-education-hub"
import { searchEducation } from "@/lib/education-content"

const TOPICS = [
    { key: "credit", title: "Credit & Debt", icon: DollarSign, items: ["Understanding credit scores", "How to improve credit", "Debt payoff strategies"] },
    { key: "investing", title: "Investing", icon: TrendingUp, items: ["What are stocks & bonds?", "Risk vs reward explained", "Portfolio diversification"] },
    { key: "budgeting", title: "Budgeting", icon: PieChart, items: ["Creating a budget", "Tracking expenses", "Emergency fund planning"] },
    { key: "retirement", title: "Retirement", icon: Shield, items: ["401(k) vs IRA explained", "Compound interest power", "Retirement calculators"] },
    { key: "taxes", title: "Tax Planning", icon: FileText, items: ["Understanding tax brackets", "Deductions vs credits", "Business vs personal taxes"] },
]

export default function EducationPage() {
    const [activeSection, setActiveSection] = useState("")
    const [selectedTopic, setSelectedTopic] = useState("credit")
    const [videoIndex, setVideoIndex] = useState(0)
    const [articleIndex, setArticleIndex] = useState(0)
    const [query, setQuery] = useState("")

    const openTopic = (topic: string) => {
        setSelectedTopic(topic)
        setVideoIndex(0)
        setArticleIndex(0)
        setActiveSection("financial-education")
    }

    const openResult = (doc: ReturnType<typeof searchEducation>[number]) => {
        setSelectedTopic(doc.topic)
        setVideoIndex(doc.type === "video" ? doc.index : 0)
        setArticleIndex(doc.type === "article" ? doc.index : 0)
        setActiveSection("financial-education")
    }

    const handleBackToTab = () => setActiveSection("")

    const results = useMemo(() => searchEducation(query), [query])
    const q = query.trim()

    if (activeSection === "financial-education") {
        return (
            <div className="min-h-screen bg-muted/40">
                <main className="container mx-auto px-4 py-8 max-w-6xl">
                    <FinancialEducationHub
                        onBack={handleBackToTab}
                        initialTopic={selectedTopic}
                        initialVideoIndex={videoIndex}
                        initialArticleIndex={articleIndex}
                    />
                </main>
            </div>
        )
    }

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

                    {/* Search */}
                    <div className="relative max-w-xl mx-auto">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            className="pl-9"
                            placeholder="Search lessons & articles — e.g. how to invest, paying off debt"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                        />
                    </div>

                    {q ? (
                        results.length > 0 ? (
                            <div className="space-y-3">
                                <p className="text-sm text-muted-foreground">
                                    {results.length} result{results.length !== 1 ? "s" : ""} for “{q}”
                                </p>
                                <div className="grid grid-cols-2 gap-4">
                                    {results.map((doc) => {
                                        const Icon = doc.type === "video" ? Play : BookOpen
                                        return (
                                            <button
                                                key={`${doc.type}-${doc.topic}-${doc.index}`}
                                                onClick={() => openResult(doc)}
                                                className="flex items-start gap-3 p-4 rounded-xl border border-border bg-background hover:bg-muted/60 hover:shadow-md transition-all text-left"
                                            >
                                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${doc.type === "video" ? "bg-red-50 text-red-600 dark:bg-red-950" : "bg-blue-50 text-blue-600 dark:bg-blue-950"}`}>
                                                    <Icon className="h-5 w-5" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-semibold leading-snug">{doc.title}</p>
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        {doc.type === "video" ? "Video lesson" : "Article"} · {doc.topicName}
                                                    </p>
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-16">
                                <Search className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                                <p className="text-lg font-semibold text-foreground">We couldn’t find anything for “{q}”</p>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Try different words, or browse the topics below. We may not have a lesson on that yet.
                                </p>
                                <Button variant="outline" className="mt-4" onClick={() => setQuery("")}>
                                    Browse all topics
                                </Button>
                            </div>
                        )
                    ) : (
                        <div className="grid grid-cols-4 gap-6">
                            {TOPICS.map((t) => {
                                const Icon = t.icon
                                return (
                                    <Card
                                        key={t.key}
                                        className="hover:shadow-lg transition-shadow cursor-pointer"
                                        onClick={() => openTopic(t.key)}
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
                    )}
                </section>
            </main>
        </div>
    )
}
