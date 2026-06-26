"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, ExternalLink, DollarSign, TrendingUp, PieChart, Shield, FileText } from "lucide-react"
import FinancialEducationHub from "@/components/financial-education-hub"

export default function EducationPage() {
    const [activeSection, setActiveSection] = useState("")
    const [selectedTopic, setSelectedTopic] = useState("credit");


    const handleSectionClick = (section: string, topic?: string) => {
        setActiveSection(section);
        if (topic) {
            setSelectedTopic(topic);
        }
    }

    const handleBackToTab = () => {
        setActiveSection("")
    }

    const renderContent = () => {
        if (activeSection === "financial-education") {
            return <FinancialEducationHub onBack={handleBackToTab} initialTopic={selectedTopic} />
        }
        return (
            <section className="space-y-8">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-primary mb-4">Build Financial Confidence</h1>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        Master personal finance fundamentals with easy-to-understand lessons, videos, and expert guidance.
                    </p>
                </div>

                {/* <Card className="bg-gradient-to-r from-blue-50 to-green-50 border-blue-200 mb-8">
                    <CardHeader className="pb-3">
                        <div className="flex items-center gap-2">
                            <Users className="h-5 w-5 text-primary" />
                            <CardTitle className="text-lg">Connect with Real Financial Advisors</CardTitle>
                        </div>
                        <CardDescription className="text-sm">
                            Get personalized advice from certified professionals
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                            <div className="text-sm text-muted-foreground">
                                Ready for professional guidance? Connect with vetted financial advisors for personalized strategies.
                            </div>
                            <Button className="bg-primary hover:bg-primary/90">
                                Find an Advisor <ExternalLink className="h-4 w-4 ml-2" />
                            </Button>
                        </div>
                    </CardContent>
                </Card> */}

                <div className="grid grid-cols-4 gap-6 mb-8">
                    <Card
                        className="hover:shadow-lg transition-shadow cursor-pointer"
                        onClick={() => handleSectionClick("financial-education", "credit")}
                    >
                        <CardHeader className="text-center pb-2">
                            <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center mx-auto mb-2">
                                <DollarSign className="h-6 w-6 text-primary-foreground" />
                            </div>
                            <CardTitle className="text-base">Credit & Debt</CardTitle>
                        </CardHeader>
                        <CardContent className="text-center">
                            <div className="space-y-1 text-sm mb-3">
                                <div>â€¢ Understanding credit scores</div>
                                <div>â€¢ How to improve credit</div>
                                <div>â€¢ Debt payoff strategies</div>
                            </div>
                            <Button size="sm" className="w-full bg-transparent" variant="outline">
                                Learn More
                            </Button>
                        </CardContent>
                    </Card>
                    <Card
                        className="hover:shadow-lg transition-shadow cursor-pointer"
                        onClick={() => handleSectionClick("financial-education", "investing")}
                    >
                        <CardHeader className="text-center pb-2">
                            <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center mx-auto mb-2">
                                <TrendingUp className="h-6 w-6 text-primary-foreground" />
                            </div>
                            <CardTitle className="text-base">Investing</CardTitle>
                        </CardHeader>
                        <CardContent className="text-center">
                            <div className="space-y-1 text-sm mb-3">
                                <div>â€¢ What are stocks & bonds?</div>
                                <div>â€¢ Risk vs reward explained</div>
                                <div>â€¢ Portfolio diversification</div>
                            </div>
                            <Button size="sm" className="w-full bg-transparent" variant="outline">
                                Learn More
                            </Button>
                        </CardContent>
                    </Card>
                    <Card
                        className="hover:shadow-lg transition-shadow cursor-pointer"
                        onClick={() => handleSectionClick("financial-education", "budgeting")}
                    >
                        <CardHeader className="text-center pb-2">
                            <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center mx-auto mb-2">
                                <PieChart className="h-6 w-6 text-primary-foreground" />
                            </div>
                            <CardTitle className="text-base">Budgeting</CardTitle>
                        </CardHeader>
                        <CardContent className="text-center">
                            <div className="space-y-1 text-sm mb-3">
                                <div>â€¢ Creating a budget</div>
                                <div>â€¢ Tracking expenses</div>
                                <div>â€¢ Emergency fund planning</div>
                            </div>
                            <Button size="sm" className="w-full bg-transparent" variant="outline">
                                Learn More
                            </Button>
                        </CardContent>
                    </Card>
                    <Card
                        className="hover:shadow-lg transition-shadow cursor-pointer"
                        onClick={() => handleSectionClick("financial-education", "retirement")}
                    >
                        <CardHeader className="text-center pb-2">
                            <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center mx-auto mb-2">
                                <Shield className="h-6 w-6 text-primary-foreground" />
                            </div>
                            <CardTitle className="text-base">Retirement</CardTitle>
                        </CardHeader>
                        <CardContent className="text-center">
                            <div className="space-y-1 text-sm mb-3">
                                <div>â€¢ 401(k) vs IRA explained</div>
                                <div>â€¢ Compound interest power</div>
                                <div>â€¢ Retirement calculators</div>
                            </div>
                            <Button size="sm" className="w-full bg-transparent" variant="outline">
                                Learn More
                            </Button>
                        </CardContent>
                    </Card>
                    <Card
                        className="hover:shadow-lg transition-shadow cursor-pointer"
                        onClick={() => handleSectionClick("financial-education", "taxes")}
                    >
                        <CardHeader className="text-center pb-2">
                            <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center mx-auto mb-2">
                                <FileText className="h-6 w-6 text-primary-foreground" />
                            </div>
                            <CardTitle className="text-base">Tax Planning</CardTitle>
                        </CardHeader>
                        <CardContent className="text-center">
                            <div className="space-y-1 text-sm mb-3">
                                <div>â€¢ Understanding tax brackets</div>
                                <div>â€¢ Deductions vs credits</div>
                                <div>â€¢ Business vs personal taxes</div>
                            </div>
                            <Button size="sm" className="w-full bg-transparent" variant="outline">
                                Learn More
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </section>
        )
    }

    return (
        <div className="min-h-screen bg-muted/40">
            <main className="container mx-auto px-4 py-8 max-w-6xl">
                {renderContent()}
            </main>
        </div>
    )
}
