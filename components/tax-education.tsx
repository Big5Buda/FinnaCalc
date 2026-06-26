"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
    ArrowLeft,
    Calculator,
    DollarSign,
    Search,
    Calendar,
    PieChart,
    TrendingUp,
    ExternalLink,
    Info,
} from "lucide-react"

interface TaxCalculatorsProps {
    onBack: () => void
}

export default function TaxCalculators({ onBack }: TaxCalculatorsProps) {
    const [activeCalculator, setActiveCalculator] = useState("tax-calculator")
    const [income, setIncome] = useState("")
    const [filingStatus, setFilingStatus] = useState("single")
    const [deductions, setDeductions] = useState("standard")
    const [results, setResults] = useState<any>(null)

    const calculators = [
        {
            id: "tax-calculator",
            title: "Tax Calculator",
            description: "Estimate your federal tax liability",
            icon: <Calculator className="h-5 w-5" />,
        },
        {
            id: "refund-estimator",
            title: "Refund Estimator",
            description: "See your potential tax refund",
            icon: <DollarSign className="h-5 w-5" />,
        },
        {
            id: "deduction-finder",
            title: "Deduction Finder",
            description: "Discover write-offs you might miss",
            icon: <Search className="h-5 w-5" />,
        },
        {
            id: "quarterly-calculator",
            title: "Quarterly Payments",
            description: "Calculate estimated tax payments",
            icon: <Calendar className="h-5 w-5" />,
        },
        {
            id: "withholding-calculator",
            title: "Withholding Calculator",
            description: "Adjust your paycheck withholdings",
            icon: <PieChart className="h-5 w-5" />,
        },
    ]

    const calculateTax = () => {
        const incomeNum = Number.parseFloat(income) || 0
        const standardDeduction = filingStatus === "married" ? 27700 : 13850
        const taxableIncome = Math.max(0, incomeNum - standardDeduction)

        // Simplified tax brackets for 2024
        let tax = 0
        if (taxableIncome > 0) {
            if (taxableIncome <= 11000) {
                tax = taxableIncome * 0.1
            } else if (taxableIncome <= 44725) {
                tax = 1100 + (taxableIncome - 11000) * 0.12
            } else if (taxableIncome <= 95375) {
                tax = 5147 + (taxableIncome - 44725) * 0.22
            } else {
                tax = 16290 + (taxableIncome - 95375) * 0.24
            }
        }

        setResults({
            grossIncome: incomeNum,
            standardDeduction,
            taxableIncome,
            estimatedTax: tax,
            effectiveRate: incomeNum > 0 ? (tax / incomeNum) * 100 : 0,
            marginalRate: taxableIncome > 95375 ? 24 : taxableIncome > 44725 ? 22 : taxableIncome > 11000 ? 12 : 10,
        })
    }

    const deductionItems = [
        {
            category: "Home & Property",
            items: [
                { name: "Mortgage Interest", amount: "Up to $750,000 loan", common: true },
                { name: "Property Taxes", amount: "Up to $10,000", common: true },
                { name: "Home Office", amount: "Varies", common: false },
            ],
        },
        {
            category: "Medical & Health",
            items: [
                { name: "Medical Expenses", amount: "> 7.5% of AGI", common: false },
                { name: "Health Insurance Premiums", amount: "Self-employed", common: false },
                { name: "HSA Contributions", amount: "Up to $4,150", common: true },
            ],
        },
        {
            category: "Education",
            items: [
                { name: "Student Loan Interest", amount: "Up to $2,500", common: true },
                { name: "Tuition & Fees", amount: "Varies", common: false },
                { name: "Education Credits", amount: "Up to $2,500", common: true },
            ],
        },
        {
            category: "Charitable & Other",
            items: [
                { name: "Charitable Donations", amount: "Up to 60% AGI", common: true },
                { name: "State & Local Taxes", amount: "Up to $10,000", common: true },
                { name: "Business Expenses", amount: "Self-employed", common: false },
            ],
        },
    ]

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="outline" size="sm" onClick={onBack}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                </Button>
                <div>
                    <h1 className="text-3xl font-bold">Tax Optimization Tools</h1>
                    <p className="text-muted-foreground">Calculators and tools to maximize your refund</p>
                </div>
            </div>

            {/* Advertisement Space */}
            <Card className="bg-gradient-to-r from-blue-50 to-green-50 border-blue-200">
                <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <TrendingUp className="h-8 w-8 text-blue-600" />
                            <div>
                                <h3 className="font-semibold">Tax Planning Services</h3>
                                <p className="text-sm text-muted-foreground">Professional tax strategy consultation</p>
                            </div>
                        </div>
                        <Button size="sm" variant="outline">
                            Get Started <ExternalLink className="h-3 w-3 ml-1" />
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-4 gap-6">
                {/* Calculator Navigation */}
                <div className="lg:col-span-1">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Tax Tools</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="space-y-1">
                                {calculators.map((calc) => (
                                    <button
                                        key={calc.id}
                                        onClick={() => setActiveCalculator(calc.id)}
                                        className={`w-full text-left p-3 hover:bg-muted transition-colors ${
                                            activeCalculator === calc.id ? "bg-muted border-r-2 border-primary" : ""
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="text-primary">{calc.icon}</div>
                                            <div>
                                                <div className="font-medium text-sm">{calc.title}</div>
                                                <div className="text-xs text-muted-foreground">{calc.description}</div>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Calculator Content */}
                <div className="lg:col-span-3">
                    {/* Tax Calculator */}
                    {activeCalculator === "tax-calculator" && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Federal Tax Calculator</CardTitle>
                                <CardDescription>Estimate your federal income tax liability for 2024</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="income">Annual Income</Label>
                                            <Input
                                                id="income"
                                                placeholder="$75,000"
                                                value={income}
                                                onChange={(e) => setIncome(e.target.value)}
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Filing Status</Label>
                                            <div className="grid grid-cols-2 gap-2">
                                                <Button
                                                    variant={filingStatus === "single" ? "default" : "outline"}
                                                    size="sm"
                                                    onClick={() => setFilingStatus("single")}
                                                >
                                                    Single
                                                </Button>
                                                <Button
                                                    variant={filingStatus === "married" ? "default" : "outline"}
                                                    size="sm"
                                                    onClick={() => setFilingStatus("married")}
                                                >
                                                    Married
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Deduction Type</Label>
                                            <div className="grid grid-cols-2 gap-2">
                                                <Button
                                                    variant={deductions === "standard" ? "default" : "outline"}
                                                    size="sm"
                                                    onClick={() => setDeductions("standard")}
                                                >
                                                    Standard
                                                </Button>
                                                <Button
                                                    variant={deductions === "itemized" ? "default" : "outline"}
                                                    size="sm"
                                                    onClick={() => setDeductions("itemized")}
                                                >
                                                    Itemized
                                                </Button>
                                            </div>
                                        </div>

                                        <Button onClick={calculateTax} className="w-full">
                                            Calculate Tax
                                        </Button>
                                    </div>

                                    {results && (
                                        <div className="space-y-4">
                                            <h3 className="font-semibold">Tax Calculation Results</h3>
                                            <div className="space-y-3">
                                                <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                                                    <span>Gross Income</span>
                                                    <span className="font-semibold">${results.grossIncome.toLocaleString()}</span>
                                                </div>
                                                <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                                                    <span>Standard Deduction</span>
                                                    <span className="font-semibold">${results.standardDeduction.toLocaleString()}</span>
                                                </div>
                                                <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                                                    <span>Taxable Income</span>
                                                    <span className="font-semibold">${results.taxableIncome.toLocaleString()}</span>
                                                </div>
                                                <Separator />
                                                <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                                                    <span className="font-semibold">Estimated Tax</span>
                                                    <span className="text-2xl font-bold text-red-600">
                            ${results.estimatedTax.toLocaleString()}
                          </span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="text-center p-2 bg-blue-50 rounded">
                                                        <div className="text-sm text-muted-foreground">Effective Rate</div>
                                                        <div className="font-semibold">{results.effectiveRate.toFixed(1)}%</div>
                                                    </div>
                                                    <div className="text-center p-2 bg-blue-50 rounded">
                                                        <div className="text-sm text-muted-foreground">Marginal Rate</div>
                                                        <div className="font-semibold">{results.marginalRate}%</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Refund Estimator */}
                    {activeCalculator === "refund-estimator" && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Tax Refund Estimator</CardTitle>
                                <CardDescription>Estimate your potential tax refund</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="totalIncome">Total Income</Label>
                                            <Input id="totalIncome" placeholder="$65,000" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="withheld">Federal Tax Withheld</Label>
                                            <Input id="withheld" placeholder="$8,500" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="credits">Tax Credits</Label>
                                            <Input id="credits" placeholder="$2,000" />
                                        </div>
                                        <Button className="w-full">Calculate Refund</Button>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="text-center p-6 bg-green-50 rounded-lg border-2 border-green-200">
                                            <DollarSign className="h-12 w-12 text-green-600 mx-auto mb-2" />
                                            <div className="text-3xl font-bold text-green-600">$1,850</div>
                                            <div className="text-sm text-green-700">Estimated Refund</div>
                                        </div>
                                        <div className="text-xs text-muted-foreground text-center">
                                            This is an estimate. Actual refund may vary based on your complete tax situation.
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Deduction Finder */}
                    {activeCalculator === "deduction-finder" && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Deduction Finder</CardTitle>
                                <CardDescription>Discover tax deductions you might be missing</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-6">
                                    {deductionItems.map((category, index) => (
                                        <div key={index}>
                                            <h3 className="font-semibold mb-3 flex items-center gap-2">
                                                <div className="w-2 h-2 bg-primary rounded-full"></div>
                                                {category.category}
                                            </h3>
                                            <div className="grid grid-cols-3 gap-3">
                                                {category.items.map((item, itemIndex) => (
                                                    <Card key={itemIndex} className="hover:shadow-md transition-shadow">
                                                        <CardContent className="p-4">
                                                            <div className="flex items-start justify-between mb-2">
                                                                <h4 className="font-medium text-sm">{item.name}</h4>
                                                                {item.common && (
                                                                    <Badge variant="secondary" className="text-xs">
                                                                        Common
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            <p className="text-xs text-muted-foreground mb-3">{item.amount}</p>
                                                            <div className="flex items-center gap-2">
                                                                <input type="checkbox" className="rounded" />
                                                                <span className="text-xs">I have this</span>
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                    <div className="text-center pt-4">
                                        <Button>Calculate My Deductions</Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Quarterly Calculator */}
                    {activeCalculator === "quarterly-calculator" && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Quarterly Tax Payment Calculator</CardTitle>
                                <CardDescription>Calculate estimated tax payments for self-employed individuals</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="expectedIncome">Expected Annual Income</Label>
                                            <Input id="expectedIncome" placeholder="$80,000" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="businessExpenses">Business Expenses</Label>
                                            <Input id="businessExpenses" placeholder="$15,000" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="selfEmploymentTax">Self-Employment Tax</Label>
                                            <Input id="selfEmploymentTax" placeholder="Auto-calculated" disabled />
                                        </div>
                                        <Button className="w-full">Calculate Quarterly Payments</Button>
                                    </div>
                                    <div className="space-y-4">
                                        <h3 className="font-semibold">2024 Payment Schedule</h3>
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center p-3 border rounded-lg">
                                                <div>
                                                    <div className="font-medium">Q1 2024</div>
                                                    <div className="text-sm text-muted-foreground">Due: April 15</div>
                                                </div>
                                                <div className="font-semibold">$2,250</div>
                                            </div>
                                            <div className="flex justify-between items-center p-3 border rounded-lg">
                                                <div>
                                                    <div className="font-medium">Q2 2024</div>
                                                    <div className="text-sm text-muted-foreground">Due: June 17</div>
                                                </div>
                                                <div className="font-semibold">$2,250</div>
                                            </div>
                                            <div className="flex justify-between items-center p-3 border rounded-lg">
                                                <div>
                                                    <div className="font-medium">Q3 2024</div>
                                                    <div className="text-sm text-muted-foreground">Due: September 16</div>
                                                </div>
                                                <div className="font-semibold">$2,250</div>
                                            </div>
                                            <div className="flex justify-between items-center p-3 border rounded-lg">
                                                <div>
                                                    <div className="font-medium">Q4 2024</div>
                                                    <div className="text-sm text-muted-foreground">Due: January 15, 2025</div>
                                                </div>
                                                <div className="font-semibold">$2,250</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Withholding Calculator */}
                    {activeCalculator === "withholding-calculator" && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Withholding Calculator</CardTitle>
                                <CardDescription>Adjust your paycheck withholdings to avoid a big tax bill or refund</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="text-center py-12">
                                    <PieChart className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                                    <h3 className="text-xl font-semibold mb-2">W-4 Withholding Tool</h3>
                                    <p className="text-muted-foreground mb-6">
                                        This feature is coming soon. Use the IRS Withholding Estimator for now.
                                    </p>
                                    <Button variant="outline" asChild>
                                        <a href="https://www.irs.gov/individuals/tax-withholding-estimator" target="_blank" rel="noopener noreferrer">
                                            Go to IRS Website <ExternalLink className="h-4 w-4 ml-2" />
                                        </a>
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    )
}
