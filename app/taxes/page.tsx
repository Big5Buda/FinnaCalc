"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, Calculator, BookOpen } from "lucide-react"
import TaxFilingInterface from "@/components/tax-filing-interface"
import TaxCalculators from "@/components/tax-calculators"
import Link from "next/link" // Import Link

export default function TaxesPage() {
    const [activeSection, setActiveSection] = useState("")

    const handleSectionClick = (section: string) => {
        setActiveSection(section)
    }

    const handleBackToTab = () => {
        setActiveSection("")
    }

    const renderContent = () => {
        if (activeSection === "tax-filing") {
            return <TaxFilingInterface onBack={handleBackToTab} />
        }
        if (activeSection === "tax-calculators") {
            return <TaxCalculators onBack={handleBackToTab} />
        }
        // "tax-education" is now handled by a direct link
        return (
            <section className="space-y-8">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-primary mb-4">Maximize Your Tax Returns</h1>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        Easy tax filing, smart calculators, and tools to help you save money and optimize your tax strategy.
                    </p>
                </div>

                <div className="grid md:grid-cols-3 gap-6 mb-8">
                    <Card
                        className="bg-background hover:shadow-lg transition-shadow cursor-pointer border border-border flex flex-col"
                        onClick={() => handleSectionClick("tax-filing")}
                    >
                        <CardHeader className="text-center pb-4">
                            <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center mx-auto mb-3">
                                <FileText className="h-6 w-6 text-primary-foreground" />
                            </div>
                            <CardTitle className="text-lg">Easy Tax Filing</CardTitle>
                            <CardDescription className="text-sm text-muted-foreground">IRS-accurate estimate with a live refund</CardDescription>
                        </CardHeader>
                        <CardContent className="text-center flex-grow flex flex-col justify-between">
                            <p className="text-sm text-muted-foreground mb-4">
                                Answer a few questions and watch your Tax Year 2024 federal refund update live. Wages,
                                self-employment, investments, Social Security, deductions, and credits.
                            </p>
                            <Button className="w-full bg-blue-600 hover:bg-blue-700 mt-auto">Start Filing</Button>
                        </CardContent>
                    </Card>
                    <Card
                        className="bg-background hover:shadow-lg transition-shadow cursor-pointer border border-border flex flex-col"
                        onClick={() => handleSectionClick("tax-calculators")}
                    >
                        <CardHeader className="text-center pb-4">
                            <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center mx-auto mb-3">
                                <Calculator className="h-6 w-6 text-primary-foreground" />
                            </div>
                            <CardTitle className="text-lg">Tax Calculators & Tools</CardTitle>
                            <CardDescription className="text-sm text-muted-foreground">Calculators to maximize your refund</CardDescription>
                        </CardHeader>
                        <CardContent className="text-center flex-grow flex flex-col justify-between">
                            <p className="text-sm text-muted-foreground mb-4">
                                Tax calculator, deduction finder, refund estimator, and withholding calculator to optimize your
                                taxes.
                            </p>
                            <Button className="w-full bg-blue-600 hover:bg-blue-700 mt-auto">
                                Explore Tools
                            </Button>
                        </CardContent>
                    </Card>
                    <Link href="/education" className="flex">
                        <Card
                            className="bg-background hover:shadow-lg transition-shadow cursor-pointer border border-border h-full flex flex-col w-full"
                        >
                            <CardHeader className="text-center pb-4">
                                <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center mx-auto mb-3">
                                    <BookOpen className="h-6 w-6 text-primary-foreground" />
                                </div>
                                <CardTitle className="text-lg">Tax Education</CardTitle>
                                <CardDescription className="text-sm text-muted-foreground">Learn tax strategies and planning</CardDescription>
                            </CardHeader>
                            <CardContent className="text-center flex-grow flex flex-col justify-between">
                                <p className="text-sm text-muted-foreground mb-4">
                                    Understand tax brackets, deductions, business vs personal taxes, and planning strategies.
                                </p>
                                <Button className="w-full bg-blue-600 hover:bg-blue-700 mt-auto">
                                    Start Learning
                                </Button>
                            </CardContent>
                        </Card>
                    </Link>
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