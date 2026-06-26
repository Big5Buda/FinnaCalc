

"use client"




import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
    bracketTax,
    computeSelfEmploymentTax,
    marginalRate as marginalRateOf,
    STANDARD_DEDUCTION_2024,
} from "@/components/tax-engine/engine"
import type { FilingStatus } from "@/components/tax-engine/types"
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
import { cn } from "@/lib/utils"




// Helper to sanitize numeric input strings (removes commas, dollar signs, spaces, etc.)
function sanitizeNumber(value: string | number | undefined) {
    if (value == null) return 0
    const s = String(value).replace(/[^\d.-]/g, "")
    const n = Number.parseFloat(s)
    return Number.isFinite(n) ? n : 0
}




interface TaxCalculatorsProps {
    onBack: () => void
}




// List of US states for the dropdown
const usStates = [
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
    "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
    "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
    "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
    "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC"
];




export default function TaxCalculators({ onBack }: TaxCalculatorsProps) {
    const [activeCalculator, setActiveCalculator] = useState("tax-calculator")
    const [selectedState, setSelectedState] = useState(""); // State selection moved inside each calculator where relevant




    // Tax Calculator States
    const [income, setIncome] = useState("")
    const [filingStatus, setFilingStatus] = useState("single")
    const [results, setResults] = useState<any>(null)




    // Refund Estimator States
    const [refundIncome, setRefundIncome] = useState("")
    const [refundWithheld, setRefundWithheld] = useState("")
    const [refundCredits, setRefundCredits] = useState("")
    const [refundResults, setRefundResults] = useState<any>(null)




    // Quarterly Payment States
    const [quarterlyNetIncome, setQuarterlyNetIncome] = useState("")
    const [quarterlyResults, setQuarterlyResults] = useState<any>(null)




    // Deduction Finder States
    const [selectedDeductions, setSelectedDeductions] = useState<Record<string, boolean>>({})
    const [deductionResults, setDeductionResults] = useState<any>(null)




    // Withholding Calculator States
    const [withholdingIncome, setWithholdingIncome] = useState("")
    const [withholdingPayPeriods, setWithholdingPayPeriods] = useState("26")
    const [withholdingAllowances, setWithholdingAllowances] = useState("0")
    const [withholdingResults, setWithholdingResults] = useState<any>(null)




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
            description: "See your potential federal refund",
            icon: <DollarSign className="h-5 w-5" />,
        },
        {
            id: "deduction-finder",
            title: "Deduction Finder",
            description: "Discover potential federal write-offs",
            icon: <Search className="h-5 w-5" />,
        },
        {
            id: "quarterly-calculator",
            title: "Quarterly Payments",
            description: "Calculate estimated federal tax payments",
            icon: <Calendar className="h-5 w-5" />,
        },
        {
            id: "withholding-calculator",
            title: "Withholding Calculator",
            description: "Adjust federal paycheck withholdings",
            icon: <PieChart className="h-5 w-5" />,
        },
    ]




    // --- Calculation Functions ---




    const calculateTax = () => {
        const incomeNum = sanitizeNumber(income)
        const statusMap: Record<string, FilingStatus> = { single: "single", married: "mfj", head: "hoh" }
        const fs = statusMap[filingStatus] ?? "single"
        const standardDeduction = STANDARD_DEDUCTION_2024[fs]

        const taxableIncome = Math.max(0, incomeNum - standardDeduction);
        // Shared engine: exact 2024 rate-schedule tax + marginal rate.
        const tax = bracketTax(taxableIncome, fs)
        const marginalRate = marginalRateOf(taxableIncome, fs) * 100

        setResults({
            grossIncome: incomeNum,
            standardDeduction,
            taxableIncome,
            estimatedTax: tax,
            effectiveRate: incomeNum > 0 ? (tax / incomeNum) * 100 : 0,
            marginalRate,
            state: selectedState,
        });
    };




    const calculateRefund = () => {
        const incomeNum = sanitizeNumber(refundIncome)
        const withheldNum = sanitizeNumber(refundWithheld)
        const creditsNum = sanitizeNumber(refundCredits)
        const standardDeduction = STANDARD_DEDUCTION_2024.single
        const taxableIncome = Math.max(0, incomeNum - standardDeduction);
        const tax = bracketTax(taxableIncome, "single")

        const totalTaxLiability = Math.max(0, tax - creditsNum);
        const refund = withheldNum - totalTaxLiability;




        setRefundResults({
            taxLiability: totalTaxLiability,
            withheld: withheldNum,
            credits: creditsNum,
            refund: refund,
            owes: refund < 0,
            state: selectedState,
        });
    };




    const calculateQuarterly = () => {
        const netIncome = sanitizeNumber(quarterlyNetIncome)
        const se = computeSelfEmploymentTax({ taxpayer: netIncome, spouse: 0 }, { taxpayer: 0, spouse: 0 })
        const selfEmploymentTax = se.seTax
        const deductibleSETax = se.deduction
        const adjustedIncome = netIncome - deductibleSETax;
        const standardDeduction = STANDARD_DEDUCTION_2024.single
        const taxableIncome = Math.max(0, adjustedIncome - standardDeduction);
        const incomeTax = bracketTax(taxableIncome, "single")

        const totalFederalTax = incomeTax + selfEmploymentTax;
        const quarterlyPayment = totalFederalTax / 4;




        setQuarterlyResults({
            netIncome,
            selfEmploymentTax,
            incomeTax,
            totalTax: totalFederalTax,
            quarterlyPayment,
            state: selectedState,
        });
    };




    const calculateDeductions = () => {
        let totalDeductions = 0
        const selectedItems: string[] = []
        deductionItems.forEach((category) => {
            category.items.forEach((item) => {
                const key = `${category.category}-${item.name}`
                if (selectedDeductions[key]) {
                    selectedItems.push(item.name);
                    totalDeductions += item.hypotheticalValue || 1000;
                }
            })
        })
        const standardDeduction = STANDARD_DEDUCTION_2024.single
        const shouldItemize = totalDeductions > standardDeduction;
        setDeductionResults({
            totalItemized: totalDeductions,
            standardDeduction,
            shouldItemize,
            savings: shouldItemize ? totalDeductions - standardDeduction : 0,
            selectedCount: selectedItems.length,
            selectedItems,
            state: selectedState,
        });
    }




    const calculateWithholding = () => {
        const incomeNum = sanitizeNumber(withholdingIncome)
        const payPeriodsNum = sanitizeNumber(withholdingPayPeriods) || 26;
        const allowancesNum = sanitizeNumber(withholdingAllowances) || 0;
        const standardDeduction = STANDARD_DEDUCTION_2024.single
        const taxableIncome = Math.max(0, incomeNum - standardDeduction);
        const annualTax = bracketTax(taxableIncome, "single")

        const simplifiedAllowanceValue = 5150;
        const adjustedAnnualTax = Math.max(0, annualTax - (allowancesNum * simplifiedAllowanceValue * 0.12));
        const perPaycheck = adjustedAnnualTax / payPeriodsNum;
        const monthlyWithholding = adjustedAnnualTax / 12;




        setWithholdingResults({
            annualTax: adjustedAnnualTax,
            perPaycheck,
            monthlyWithholding,
            payPeriods: payPeriodsNum,
            allowances: allowancesNum,
            state: selectedState,
        });
    };




    const deductionItems = [
        // Same deductionItems array as before...
        {
            category: "Home & Property",
            items: [
                { name: "Mortgage Interest", amount: "Up to $750k loan", common: true, hypotheticalValue: 8000 },
                { name: "Property Taxes", amount: "SALT Cap $10k", common: true, hypotheticalValue: 5000 },
                { name: "Home Office", amount: "$5/sq ft (max $1.5k)", common: false, hypotheticalValue: 1500 },
                { name: "Energy Credits", amount: "Up to $3.2k", common: false, hypotheticalValue: 1000 }, // Note: Credits != Deductions
            ],
        },
        {
            category: "Medical & Health",
            items: [
                { name: "Medical Expenses", amount: "> 7.5% of AGI", common: false, hypotheticalValue: 3000 },
                { name: "HSA Contributions", amount: "Up to $4.15k/$8.3k", common: true, hypotheticalValue: 4150 }, // Above-the-line
            ],
        },
        {
            category: "Education",
            items: [
                { name: "Student Loan Interest", amount: "Up to $2.5k", common: true, hypotheticalValue: 2500 }, // Above-the-line deduction
                { name: "Educator Expenses", amount: "Up to $300", common: false, hypotheticalValue: 300 }, // Above-the-line deduction
            ],
        },
        {
            category: "Charitable & Other",
            items: [
                { name: "Charitable Donations", amount: "Up to 60% AGI", common: true, hypotheticalValue: 2000 },
                { name: "State & Local Taxes (SALT)", amount: "Up to $10k", common: true, hypotheticalValue: 10000 }, // Itemized, subject to cap with property tax
                { name: "Business Expenses", amount: "Self-employed", common: false, hypotheticalValue: 5000 }, // Schedule C
            ],
        },
        {
            category: "Retirement",
            items: [
                { name: "Traditional IRA", amount: "Up to $7k/$8k", common: true, hypotheticalValue: 7000 }, // Above-the-line deduction
                { name: "Self-Employed Retirement", amount: "Varies", common: false, hypotheticalValue: 10000 }, // E.g., SEP IRA, SIMPLE IRA - Above-the-line
            ],
        },
    ];




    const toggleDeduction = (category: string, itemName: string) => {
        const key = `${category}-${itemName}`
        setSelectedDeductions((prev) => ({
            ...prev,
            [key]: !prev[key],
        }))
        setTimeout(calculateDeductions, 0); // Recalculate after state update
    }




    const commonDisclaimer = "*Estimate is for federal taxes only. State taxes vary and are not included.*";




    return (
        <div className="space-y-6">
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




            <div className="grid lg:grid-cols-4 gap-6">
                <div className="lg:col-span-1 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Tax Tools</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="space-y-1">
                                {calculators.map((calc) => (
                                    <button
                                        key={calc.id}
                                        onClick={() => {
                                            setActiveCalculator(calc.id);
                                            // Clear specific results when switching calculators
                                            setResults(null);
                                            setRefundResults(null);
                                            setDeductionResults(null);
                                            setQuarterlyResults(null);
                                            setWithholdingResults(null);
                                        }}
                                        className={cn(
                                            "w-full text-left p-3 hover:bg-muted transition-colors flex items-center gap-3",
                                            activeCalculator === calc.id ? "bg-muted border-l-2 border-primary" : ""
                                        )}
                                    >
                                        <div className="text-primary">{calc.icon}</div>
                                        <div>
                                            <div className="font-medium text-sm">{calc.title}</div>
                                            <div className="text-xs text-muted-foreground">{calc.description}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                    {/* State Selector is now within each calculator section */}
                </div>




                <div className="lg:col-span-3">
                    {/* Tax Calculator */}
                    {activeCalculator === "tax-calculator" && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Federal Tax Calculator</CardTitle>
                                <CardDescription>Estimate your federal income tax liability</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid md:grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                        {/* State Selection (left in place for context only). If you prefer removal everywhere, I can remove it. */}
                                        <div className="space-y-2">
                                            <Label htmlFor="income">Annual Income</Label>
                                            <Input
                                                id="income"
                                                type="text"
                                                placeholder="$75,000"
                                                value={income}
                                                onChange={(e) => setIncome(e.target.value.replace(/[^\d.-]/g, ""))}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Filing Status</Label>
                                            <Select value={filingStatus} onValueChange={setFilingStatus}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select filing status" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="single">Single</SelectItem>
                                                    <SelectItem value="married">Married Filing Jointly</SelectItem>
                                                    <SelectItem value="head">Head of Household</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Deduction Type</Label>
                                            <Input value="Standard Deduction (Estimated)" disabled />
                                            <p className="text-xs text-muted-foreground">Itemized deductions can be explored in the Deduction Finder.</p>
                                        </div>
                                        <Button onClick={calculateTax} className="w-full">
                                            Calculate Federal Tax
                                        </Button>
                                    </div>




                                    {results && (
                                        <div className="space-y-4">
                                            <h3 className="font-semibold">Federal Tax Results {selectedState && `(State: ${selectedState})`}</h3>
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
                                                    <span className="font-semibold">Estimated Federal Tax</span>
                                                    <span className="text-2xl font-bold text-red-600">
                                                     ${results.estimatedTax.toFixed(0).toLocaleString()}
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
                                            <p className="text-xs text-muted-foreground text-center mt-2">{commonDisclaimer}</p>
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
                                <CardTitle>Federal Tax Refund Estimator</CardTitle>
                                <CardDescription>Estimate your potential federal tax refund</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid md:grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                        {/* Removed state selector here because refund calculations do not use state in the current logic */}
                                        <div className="space-y-2">
                                            <Label htmlFor="refundIncome">Total Annual Income</Label>
                                            <Input
                                                id="refundIncome"
                                                type="text"
                                                placeholder="$65,000"
                                                value={refundIncome}
                                                onChange={(e) => setRefundIncome(e.target.value.replace(/[^\d.-]/g, ""))}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="refundWithheld">Federal Tax Withheld</Label>
                                            <Input
                                                id="refundWithheld"
                                                type="text"
                                                placeholder="$8,500"
                                                value={refundWithheld}
                                                onChange={(e) => setRefundWithheld(e.target.value.replace(/[^\d.-]/g, ""))}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="refundCredits">Federal Tax Credits</Label>
                                            <Input
                                                id="refundCredits"
                                                type="text"
                                                placeholder="$2,000"
                                                value={refundCredits}
                                                onChange={(e) => setRefundCredits(e.target.value.replace(/[^\d.-]/g, ""))}
                                            />
                                        </div>
                                        <Button className="w-full" onClick={calculateRefund}>
                                            Calculate Federal Refund
                                        </Button>
                                    </div>
                                    <div className="space-y-4">
                                        {refundResults ? (
                                            <>
                                                <h3 className="font-semibold">Federal Refund Results {selectedState && `(State: ${selectedState})`}</h3>
                                                <div className="text-center p-6 bg-green-50 rounded-lg border-2 border-green-200">
                                                    <DollarSign className="h-12 w-12 text-green-600 mx-auto mb-2" />
                                                    <div
                                                        className={`text-3xl font-bold ${refundResults.owes ? "text-red-600" : "text-green-600"}`}
                                                    >
                                                        {refundResults.owes ? "-" : ""}${Math.abs(refundResults.refund).toFixed(0).toLocaleString()}
                                                    </div>
                                                    <div className="text-sm text-green-700">
                                                        {refundResults.owes ? "Estimated Federal Amount Owed" : "Estimated Federal Refund"}
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <div className="flex justify-between p-2 bg-muted rounded">
                                                        <span className="text-sm">Fed. Tax Liability</span>
                                                        <span className="text-sm font-semibold">
                                                         ${refundResults.taxLiability.toFixed(0).toLocaleString()}
                                                     </span>
                                                    </div>
                                                    <div className="flex justify-between p-2 bg-muted rounded">
                                                        <span className="text-sm">Fed. Tax Withheld</span>
                                                        <span className="text-sm font-semibold">
                                                         ${refundResults.withheld.toFixed(0).toLocaleString()}
                                                     </span>
                                                    </div>
                                                    <div className="flex justify-between p-2 bg-muted rounded">
                                                        <span className="text-sm">Fed. Tax Credits</span>
                                                        <span className="text-sm font-semibold">
                                                         ${refundResults.credits.toFixed(0).toLocaleString()}
                                                     </span>
                                                    </div>
                                                </div>
                                                <p className="text-xs text-muted-foreground text-center mt-2">{commonDisclaimer}</p>
                                            </>
                                        ) : (
                                            <div className="text-center p-6 bg-muted rounded-lg h-full flex flex-col justify-center">
                                                <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                                                <p className="text-sm text-muted-foreground">
                                                    Enter your info to estimate your federal refund.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}




                    {/* Deduction Finder */}
                    {activeCalculator === "deduction-finder" && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Federal Deduction Finder</CardTitle>
                                <CardDescription>Discover potential federal tax deductions {selectedState && `(context: ${selectedState})`}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-6">
                                    {/* State selector intentionally left outside of the item grid for context */}
                                    {deductionItems.map((category, index) => (
                                        <div key={index}>
                                            <h3 className="font-semibold mb-3 flex items-center gap-2">
                                                <div className="w-2 h-2 bg-primary rounded-full"></div>
                                                {category.category}
                                            </h3>
                                            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                                                {category.items.map((item, itemIndex) => {
                                                    const key = `${category.category}-${item.name}`
                                                    return (
                                                        <Card key={itemIndex} className={cn("hover:shadow-md transition-shadow h-full flex flex-col justify-between", selectedDeductions[key] ? 'border-primary' : '')}>
                                                            <CardContent className="p-4">
                                                                <div className="flex items-start justify-between mb-2">
                                                                    <h4 className="font-medium text-sm">{item.name}</h4>
                                                                    {item.common && (
                                                                        <Badge variant="secondary" className="text-xs shrink-0 ml-2">
                                                                            Common
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                                <p className="text-xs text-muted-foreground mb-3">{item.amount}</p>
                                                                <div className="flex items-center gap-2 mt-auto pt-2 border-t border-dashed">
                                                                    <input
                                                                        type="checkbox"
                                                                        id={key}
                                                                        className="rounded accent-primary cursor-pointer"
                                                                        checked={selectedDeductions[key] || false}
                                                                        onChange={() => toggleDeduction(category.category, item.name)}
                                                                    />
                                                                    <Label htmlFor={key} className="text-xs cursor-pointer">I believe I qualify</Label>
                                                                </div>
                                                            </CardContent>
                                                        </Card>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    ))}




                                    {deductionResults && (
                                        <Card className="bg-blue-50 border-blue-200 mt-6">
                                            <CardContent className="p-6">
                                                <h3 className="font-semibold mb-4 text-lg">Potential Federal Deduction Summary {selectedState && `(State: ${selectedState})`}</h3>
                                                <div className="space-y-3">
                                                    <div className="flex justify-between items-center">
                                                        <span>Selected Potential Deductions</span>
                                                        <span className="font-semibold">{deductionResults.selectedCount} items</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span>Estimated Itemized Total*</span>
                                                        <span className="font-semibold">${deductionResults.totalItemized.toLocaleString()}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span>Standard Deduction (Single 2024)</span>
                                                        <span className="font-semibold">
                                                         ${deductionResults.standardDeduction.toLocaleString()}
                                                     </span>
                                                    </div>
                                                    <Separator />
                                                    <div className="flex justify-between items-center p-3 bg-background rounded-lg">
                                                        <span className="font-semibold">Recommendation</span>
                                                        <span className="font-bold text-primary">
                                                         {deductionResults.shouldItemize ? "Likely Better to Itemize (Federal)" : "Likely Better to Take Standard (Federal)"}
                                                     </span>
                                                    </div>
                                                    {deductionResults.shouldItemize && (
                                                        <div className="text-center p-3 bg-green-100 rounded-lg">
                                                            <p className="text-sm font-semibold text-green-800">
                                                                Itemizing could potentially increase your federal deduction by ${deductionResults.savings.toLocaleString()}!*
                                                            </p>
                                                        </div>
                                                    )}
                                                    <p className="text-xs text-muted-foreground text-center mt-2">*Based on hypothetical values. Actual amounts vary. State deduction rules differ.</p>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    )}




                                </div>
                            </CardContent>
                        </Card>
                    )}




                    {/* Quarterly Calculator */}
                    {activeCalculator === "quarterly-calculator" && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Quarterly Federal Tax Payment Calculator</CardTitle>
                                <CardDescription>Estimate federal tax payments for self-employed individuals</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid md:grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                        {/* Removed the state selector here (purely contextual in previous code) */}
                                        <div className="space-y-2">
                                            <Label htmlFor="quarterlyNetIncome">Expected Annual Net Income (After Expenses)</Label>
                                            <Input
                                                id="quarterlyNetIncome"
                                                type="text"
                                                placeholder="$80,000"
                                                value={quarterlyNetIncome}
                                                onChange={(e) => setQuarterlyNetIncome(e.target.value.replace(/[^\d.-]/g, ""))}
                                            />
                                        </div>
                                        <Button className="w-full" onClick={calculateQuarterly}>
                                            Calculate Federal Quarterly Payments
                                        </Button>
                                    </div>
                                    <div className="space-y-4">
                                        {quarterlyResults ? (
                                            <>
                                                <h3 className="font-semibold">Federal Payment Results {selectedState && `(State: ${selectedState})`}</h3>
                                                <div className="space-y-2 p-4 bg-muted rounded-lg">
                                                    <div className="flex justify-between">
                                                        <span className="text-sm">Net Income (Est.)</span>
                                                        <span className="text-sm font-semibold">
                                                         ${quarterlyResults.netIncome.toLocaleString()}
                                                     </span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-sm">Fed. Income Tax (Est.)</span>
                                                        <span className="text-sm font-semibold">
                                                         ${quarterlyResults.incomeTax.toFixed(0).toLocaleString()}
                                                     </span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-sm">SE Tax (Est.)</span>
                                                        <span className="text-sm font-semibold">
                                                         ${quarterlyResults.selfEmploymentTax.toFixed(0).toLocaleString()}
                                                     </span>
                                                    </div>
                                                    <Separator />
                                                    <div className="flex justify-between">
                                                        <span className="font-semibold">Total Annual Federal Tax (Est.)</span>
                                                        <span className="font-bold">${quarterlyResults.totalTax.toFixed(0).toLocaleString()}</span>
                                                    </div>
                                                </div>
                                                <h3 className="font-semibold mt-4">Estimated Federal Payments (2024 Schedule)</h3>
                                                <div className="space-y-3">
                                                    <div className="flex justify-between items-center p-3 border rounded-lg">
                                                        <div>
                                                            <div className="font-medium">Q1 2024</div>
                                                            <div className="text-sm text-muted-foreground">Due: April 15</div>
                                                        </div>
                                                        <div className="font-semibold">
                                                            ${quarterlyResults.quarterlyPayment.toFixed(0).toLocaleString()}
                                                        </div>
                                                    </div>
                                                    <div className="flex justify-between items-center p-3 border rounded-lg">
                                                        <div>
                                                            <div className="font-medium">Q2 2024</div>
                                                            <div className="text-sm text-muted-foreground">Due: June 17</div>
                                                        </div>
                                                        <div className="font-semibold">
                                                            ${quarterlyResults.quarterlyPayment.toFixed(0).toLocaleString()}
                                                        </div>
                                                    </div>
                                                    <div className="flex justify-between items-center p-3 border rounded-lg">
                                                        <div>
                                                            <div className="font-medium">Q3 2024</div>
                                                            <div className="text-sm text-muted-foreground">Due: September 16</div>
                                                        </div>
                                                        <div className="font-semibold">
                                                            ${quarterlyResults.quarterlyPayment.toFixed(0).toLocaleString()}
                                                        </div>
                                                    </div>
                                                    <div className="flex justify-between items-center p-3 border rounded-lg">
                                                        <div>
                                                            <div className="font-medium">Q4 2024</div>
                                                            <div className="text-sm text-muted-foreground">Due: January 15, 2025</div>
                                                        </div>
                                                        <div className="font-semibold">
                                                            ${quarterlyResults.quarterlyPayment.toFixed(0).toLocaleString()}
                                                        </div>
                                                    </div>
                                                </div>
                                                <p className="text-xs text-muted-foreground text-center mt-2">{commonDisclaimer} State quarterly payments may also be required.</p>
                                            </>
                                        ) : (
                                            <div className="text-center p-12 bg-muted rounded-lg h-full flex flex-col justify-center">
                                                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                                                <p className="text-sm text-muted-foreground">Enter net income to estimate federal payments.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}




                    {/* Withholding Calculator */}
                    {activeCalculator === "withholding-calculator" && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Federal Withholding Calculator</CardTitle>
                                <CardDescription>Estimate federal tax withholdings from your paycheck (simplified)</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-6">
                                    <div className="grid md:grid-cols-2 gap-6">
                                        <div className="space-y-4">
                                            {/* Removed the state selector here (contextual only previously) */}
                                            <div className="space-y-2">
                                                <Label htmlFor="withholdingIncome">Annual Salary</Label>
                                                <Input
                                                    id="withholdingIncome"
                                                    type="text"
                                                    placeholder="$75,000"
                                                    value={withholdingIncome}
                                                    onChange={(e) => setWithholdingIncome(e.target.value.replace(/[^\d.-]/g, ""))}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="withholdingPayPeriods">Pay Periods per Year</Label>
                                                <Input
                                                    id="withholdingPayPeriods"
                                                    type="text"
                                                    placeholder="26 (bi-weekly)"
                                                    value={withholdingPayPeriods}
                                                    onChange={(e) => setWithholdingPayPeriods(e.target.value.replace(/[^\d.-]/g, ""))}
                                                />
                                                <p className="text-xs text-muted-foreground">Weekly: 52, Bi-weekly: 26, Monthly: 12</p>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="withholdingAllowances">W-4 Allowances (Simplified)</Label>
                                                <Input
                                                    id="withholdingAllowances"
                                                    type="text"
                                                    placeholder="0"
                                                    value={withholdingAllowances}
                                                    onChange={(e) => setWithholdingAllowances(e.target.value.replace(/[^\d.-]/g, ""))}
                                                />
                                                <p className="text-xs text-muted-foreground">Note: Uses older allowance system for estimation.</p>
                                            </div>
                                            <Button className="w-full" onClick={calculateWithholding}>
                                                Calculate Federal Withholding
                                            </Button>
                                        </div>
                                        <div className="space-y-4">
                                            {withholdingResults ? (
                                                <>
                                                    <h3 className="font-semibold">Federal Withholding Results {selectedState && `(State: ${selectedState})`}</h3>
                                                    <div className="text-center p-6 bg-blue-50 rounded-lg border-2 border-blue-200">
                                                        <PieChart className="h-12 w-12 text-blue-600 mx-auto mb-2" />
                                                        <div className="text-3xl font-bold text-blue-600">
                                                            ${withholdingResults.perPaycheck.toFixed(0).toLocaleString()}
                                                        </div>
                                                        <div className="text-sm text-blue-700">Federal Tax Per Paycheck (Est.)</div>
                                                    </div>
                                                    <div className="space-y-3">
                                                        <div className="flex justify-between p-3 bg-muted rounded-lg">
                                                            <span>Est. Annual Federal Tax</span>
                                                            <span className="font-semibold">
                                                             ${withholdingResults.annualTax.toFixed(0).toLocaleString()}
                                                         </span>
                                                        </div>
                                                        <div className="flex justify-between p-3 bg-muted rounded-lg">
                                                            <span>Est. Monthly Federal Withholding</span>
                                                            <span className="font-semibold">
                                                             ${withholdingResults.monthlyWithholding.toFixed(0).toLocaleString()}
                                                         </span>
                                                        </div>
                                                        <div className="flex justify-between p-3 bg-muted rounded-lg">
                                                            <span>Pay Periods</span>
                                                            <span className="font-semibold">{withholdingResults.payPeriods}</span>
                                                        </div>
                                                    </div>
                                                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg mt-4">
                                                        <p className="text-sm text-yellow-800">
                                                            <strong>Tip:</strong> Use the official IRS Withholding Estimator for accurate W-4 adjustments. State withholding not included.
                                                        </p>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="text-center p-12 bg-muted rounded-lg h-full flex flex-col justify-center">
                                                    <PieChart className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                                                    <p className="text-sm text-muted-foreground">Enter info to estimate federal withholding.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="p-4 bg-muted rounded-lg mt-6">
                                        <h4 className="font-semibold mb-2 flex items-center gap-2">
                                            <Info className="h-4 w-4" />
                                            About W-4 Withholding
                                        </h4>
                                        <p className="text-sm text-muted-foreground">
                                            Your W-4 form tells your employer how much federal tax to withhold. Adjusting it helps match your tax liability to avoid owing or overpaying significantly.
                                        </p>
                                        <Button variant="link" size="sm" asChild className="p-0 h-auto mt-2">
                                            <a href="https://www.irs.gov/individuals/tax-withholding-estimator" target="_blank" rel="noopener noreferrer">
                                                Use Official IRS Estimator <ExternalLink className="h-3 w-3 ml-1" />
                                            </a>
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    )
}



