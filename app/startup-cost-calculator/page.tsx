"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Share2, Download, Building2, PieChart, Calculator, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"

export default function StartupCostCalculator() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("costs"); // State to track the active tab

  // Cost States
  const [businessType, setBusinessType] = useState("")
  const [equipment, setEquipment] = useState("")
  const [inventory, setInventory] = useState("")
  const [marketing, setMarketing] = useState("")
  const [legal, setLegal] = useState("")
  const [rent, setRent] = useState("")
  const [utilities, setUtilities] = useState("")
  const [insurance, setInsurance] = useState("")
  const [other, setOther] = useState("")
  const [employees, setEmployees] = useState("")
  const [salaries, setSalaries] = useState("")
  const [permits, setPermits] = useState("")
  const [website, setWebsite] = useState("")
  const [workingCapital, setWorkingCapital] = useState("")

  // Funding States
  const [personalSavings, setPersonalSavings] = useState("")
  const [loanAmount, setLoanAmount] = useState("")
  const [investorFunding, setInvestorFunding] = useState("")

  const [result, setResult] = useState<any>(null) // State to hold calculation results

  // Function to handle tab changes and clear results
  const handleTabChange = (value: string) => {
    setResult(null); // Clear previous results when changing tabs
    setActiveTab(value);
  };

  const businessTemplates: { [key: string]: any } = {
    retail: {
      equipment: 25000,
      inventory: 15000,
      marketing: 8000,
      legal: 3500,
      rent: 12000,
      utilities: 2000,
      insurance: 3000,
      permits: 1500,
      website: 3000,
      workingCapital: 10000,
    },
    restaurant: {
      equipment: 50000,
      inventory: 8000,
      marketing: 10000,
      legal: 5000,
      rent: 18000,
      utilities: 3000,
      insurance: 4000,
      permits: 3000,
      website: 2000,
      workingCapital: 15000,
    },
    service: {
      equipment: 8000,
      inventory: 2000,
      marketing: 5000,
      legal: 2500,
      rent: 6000,
      utilities: 1000,
      insurance: 2000,
      permits: 500,
      website: 4000,
      workingCapital: 8000,
    },
    online: {
      equipment: 5000,
      inventory: 10000,
      marketing: 12000,
      legal: 2000,
      rent: 0,
      utilities: 500,
      insurance: 1500,
      permits: 200,
      website: 8000,
      workingCapital: 12000,
    },
    manufacturing: {
      equipment: 75000,
      inventory: 25000,
      marketing: 8000,
      legal: 5000,
      rent: 15000,
      utilities: 4000,
      insurance: 6000,
      permits: 5000,
      website: 3000,
      workingCapital: 25000,
    },
    consulting: {
      equipment: 3000,
      inventory: 0,
      marketing: 6000,
      legal: 2000,
      rent: 3000,
      utilities: 800,
      insurance: 1500,
      permits: 300,
      website: 5000,
      workingCapital: 5000,
    },
  }

  const loadTemplate = () => {
    if (businessType && businessTemplates[businessType]) {
      const template = businessTemplates[businessType]
      setEquipment(template.equipment.toString())
      setInventory(template.inventory.toString())
      setMarketing(template.marketing.toString())
      setLegal(template.legal.toString())
      setRent(template.rent.toString())
      setUtilities(template.utilities.toString())
      setInsurance(template.insurance.toString())
      setPermits(template.permits.toString())
      setWebsite(template.website.toString())
      setWorkingCapital(template.workingCapital.toString())
      // Clear results when loading template
      setResult(null);
    }
  }

  const calculateStartupCosts = () => {
    setResult(null); // Clear previous results before calculating
    const costs = {
      equipment: Number.parseFloat(equipment) || 0,
      inventory: Number.parseFloat(inventory) || 0,
      marketing: Number.parseFloat(marketing) || 0,
      legal: Number.parseFloat(legal) || 0,
      rent: Number.parseFloat(rent) || 0,
      utilities: Number.parseFloat(utilities) || 0,
      insurance: Number.parseFloat(insurance) || 0,
      other: Number.parseFloat(other) || 0,
      employees: Number.parseFloat(employees) || 0,
      salaries: Number.parseFloat(salaries) || 0,
      permits: Number.parseFloat(permits) || 0,
      website: Number.parseFloat(website) || 0,
      workingCapital: Number.parseFloat(workingCapital) || 0,
    }

    const totalCosts = Object.values(costs).reduce((sum, cost) => sum + cost, 0)
    const recommendedBuffer = totalCosts * 0.2 // 20% buffer
    const totalWithBuffer = totalCosts + recommendedBuffer

    const funding = {
      personalSavings: Number.parseFloat(personalSavings) || 0,
      loanAmount: Number.parseFloat(loanAmount) || 0,
      investorFunding: Number.parseFloat(investorFunding) || 0,
    }

    const totalFunding = Object.values(funding).reduce((sum, amount) => sum + amount, 0)
    const fundingGap = totalWithBuffer - totalFunding

    const costCategories = [
      { name: "Equipment & Technology", value: costs.equipment, color: "#3B82F6" },
      { name: "Inventory", value: costs.inventory, color: "#10B981" },
      { name: "Marketing", value: costs.marketing, color: "#F59E0B" },
      { name: "Legal & Professional", value: costs.legal, color: "#EF4444" },
      { name: "Rent & Utilities", value: costs.rent + costs.utilities, color: "#8B5CF6" },
      { name: "Insurance & Permits", value: costs.insurance + costs.permits, color: "#06B6D4" },
      { name: "Website & Digital", value: costs.website, color: "#84CC16" },
      { name: "Working Capital", value: costs.workingCapital, color: "#F97316" },
      { name: "Salaries & Staff", value: costs.salaries + costs.employees, color: "#EC4899" },
      { name: "Other", value: costs.other, color: "#6B7280" },
    ].filter((category) => category.value > 0)

    setResult({
      costs,
      totalCosts,
      recommendedBuffer,
      totalWithBuffer,
      businessType,
      funding,
      totalFunding,
      fundingGap,
      costCategories,
    })
  }

  const shareResults = () => {
    if (result) {
      const shareText = `My startup cost estimate: $${result.totalWithBuffer.toLocaleString()} for a ${result.businessType} business. Calculate yours at ${window.location.href}`
      if (navigator.share) {
        navigator.share({
          title: "Startup Cost Calculator Results",
          text: shareText,
          url: window.location.href,
        })
      } else {
        navigator.clipboard.writeText(shareText)
        alert("Results copied to clipboard!")
      }
    }
  }

  const downloadReport = () => {
    if (result) {
      const reportData = {
        businessType: result.businessType,
        totalCosts: result.totalCosts,
        totalWithBuffer: result.totalWithBuffer,
        costs: result.costs,
        funding: result.funding,
        fundingGap: result.fundingGap,
        generatedAt: new Date().toISOString(),
      }

      const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `startup-cost-report-${Date.now()}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
  }

  return (
      <div className="min-h-screen bg-muted/40">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="mb-8">
            <Button variant="outline" onClick={() => router.back()} className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-8">
            <div>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-6 w-6 text-blue-600" />
                    Enhanced Startup Cost Calculator
                  </CardTitle>
                  <CardDescription>Comprehensive startup cost estimation with funding analysis</CardDescription>
                </CardHeader>
                <CardContent>
                  {/* **FIX**: Added value and onValueChange to Tabs */}
                  <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="costs">Startup Costs</TabsTrigger>
                      <TabsTrigger value="funding">Funding Sources</TabsTrigger>
                    </TabsList>

                    <TabsContent value="costs" className="space-y-6">
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <Label htmlFor="businessType">Business Type</Label>
                          <Select value={businessType} onValueChange={setBusinessType}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select business type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="retail">Retail Store</SelectItem>
                              <SelectItem value="restaurant">Restaurant</SelectItem>
                              <SelectItem value="service">Service Business</SelectItem>
                              <SelectItem value="online">Online Business</SelectItem>
                              <SelectItem value="manufacturing">Manufacturing</SelectItem>
                              <SelectItem value="consulting">Consulting</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {businessType && (
                            <Button onClick={loadTemplate} variant="outline" className="mt-6 bg-transparent">
                              Load Template
                            </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="equipment">Equipment & Technology ($)</Label>
                          <Input
                              id="equipment"
                              type="number"
                              placeholder="15000"
                              value={equipment}
                              onChange={(e) => setEquipment(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="inventory">Initial Inventory ($)</Label>
                          <Input
                              id="inventory"
                              type="number"
                              placeholder="10000"
                              value={inventory}
                              onChange={(e) => setInventory(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="marketing">Marketing & Advertising ($)</Label>
                          <Input
                              id="marketing"
                              type="number"
                              placeholder="5000"
                              value={marketing}
                              onChange={(e) => setMarketing(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="legal">Legal & Professional Fees ($)</Label>
                          <Input
                              id="legal"
                              type="number"
                              placeholder="3000"
                              value={legal}
                              onChange={(e) => setLegal(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="rent">First 3 Months Rent ($)</Label>
                          <Input
                              id="rent"
                              type="number"
                              placeholder="9000"
                              value={rent}
                              onChange={(e) => setRent(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="utilities">Utilities Setup ($)</Label>
                          <Input
                              id="utilities"
                              type="number"
                              placeholder="1500"
                              value={utilities}
                              onChange={(e) => setUtilities(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="insurance">Insurance (Annual) ($)</Label>
                          <Input
                              id="insurance"
                              type="number"
                              placeholder="2400"
                              value={insurance}
                              onChange={(e) => setInsurance(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="permits">Permits & Licenses ($)</Label>
                          <Input
                              id="permits"
                              type="number"
                              placeholder="1500"
                              value={permits}
                              onChange={(e) => setPermits(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="website">Website & Digital Setup ($)</Label>
                          <Input
                              id="website"
                              type="number"
                              placeholder="3000"
                              value={website}
                              onChange={(e) => setWebsite(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="employees">Employee Setup Costs ($)</Label>
                          <Input
                              id="employees"
                              type="number"
                              placeholder="2000"
                              value={employees}
                              onChange={(e) => setEmployees(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="salaries">First 3 Months Salaries ($)</Label>
                          <Input
                              id="salaries"
                              type="number"
                              placeholder="15000"
                              value={salaries}
                              onChange={(e) => setSalaries(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="workingCapital">Working Capital ($)</Label>
                          <Input
                              id="workingCapital"
                              type="number"
                              placeholder="10000"
                              value={workingCapital}
                              onChange={(e) => setWorkingCapital(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="other">Other Expenses ($)</Label>
                          <Input
                              id="other"
                              type="number"
                              placeholder="2000"
                              value={other}
                              onChange={(e) => setOther(e.target.value)}
                          />
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="funding" className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="personalSavings">Personal Savings ($)</Label>
                          <Input
                              id="personalSavings"
                              type="number"
                              placeholder="25000"
                              value={personalSavings}
                              onChange={(e) => setPersonalSavings(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="loanAmount">Business Loan ($)</Label>
                          <Input
                              id="loanAmount"
                              type="number"
                              placeholder="50000"
                              value={loanAmount}
                              onChange={(e) => setLoanAmount(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="investorFunding">Investor Funding ($)</Label>
                          <Input
                              id="investorFunding"
                              type="number"
                              placeholder="100000"
                              value={investorFunding}
                              onChange={(e) => setInvestorFunding(e.target.value)}
                          />
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>

                  <Button onClick={calculateStartupCosts} className="w-full bg-blue-600 hover:bg-blue-700 mt-6" size="lg">
                    <Calculator className="h-4 w-4 mr-2" />
                    Calculate Comprehensive Startup Costs
                  </Button>

                  {/* **FIX**: Conditional rendering based on result */}
                  {result && (
                      <div className="calculator-result space-y-6 mt-6">
                        <h3 className="text-lg font-semibold text-blue-800">Your Comprehensive Startup Analysis</h3>

                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Total Startup Costs</p>
                            <p className="text-3xl font-bold text-green-600">${result.totalCosts.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Recommended Total (with 20% buffer)</p>
                            <p className="text-2xl font-bold text-blue-600">${result.totalWithBuffer.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Total Funding Available</p>
                            <p className="text-2xl font-bold text-purple-600">${result.totalFunding.toLocaleString()}</p>
                          </div>
                        </div>

                        <div className="bg-muted/40 p-4 rounded-lg">
                          <h4 className="font-semibold mb-3">Funding Analysis:</h4>
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span>Required Capital:</span>
                              <span className="font-semibold">${result.totalWithBuffer.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span>Available Funding:</span>
                              <span className="font-semibold">${result.totalFunding.toLocaleString()}</span>
                            </div>
                            <div className="border-t pt-2">
                              <div className="flex justify-between items-center">
                                <span>Funding Gap:</span>
                                <span className={`font-bold ${result.fundingGap > 0 ? "text-red-600" : "text-green-600"}`}>
                              {result.fundingGap > 0 ? "-" : "+"}${Math.abs(result.fundingGap).toLocaleString()}
                            </span>
                              </div>
                            </div>
                            <Progress
                                value={Math.min((result.totalFunding / result.totalWithBuffer) * 100, 100)}
                                className="mt-2"
                            />
                            <p className="text-xs text-muted-foreground">
                              {result.fundingGap > 0
                                  ? `You need an additional $${result.fundingGap.toLocaleString()} in funding`
                                  : `You have sufficient funding with $${Math.abs(result.fundingGap).toLocaleString()} surplus`}
                            </p>
                          </div>
                        </div>

                        <div className="bg-muted/40 p-4 rounded-lg">
                          <h4 className="font-semibold mb-3 flex items-center gap-2">
                            <PieChart className="h-4 w-4" />
                            Detailed Cost Breakdown:
                          </h4>
                          <div className="space-y-3">
                            {result.costCategories.map((category : any, index : number) => (
                                <div key={index} className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: category.color }} />
                                    <span className="text-sm">{category.name}:</span>
                                  </div>
                                  <div className="text-right">
                                    <span className="font-semibold">${category.value.toLocaleString()}</span>
                                    <span className="text-xs text-muted-foreground ml-2">
                                ({((category.value / result.totalCosts) * 100).toFixed(1)}%)
                              </span>
                                  </div>
                                </div>
                            ))}
                          </div>
                        </div>

                        <div className="flex gap-2 pt-4">
                          <Button
                              onClick={shareResults}
                              variant="outline"
                              className="flex items-center gap-2 bg-transparent"
                          >
                            <Share2 className="h-4 w-4" />
                            Share Results
                          </Button>
                          <Button
                              onClick={downloadReport}
                              variant="outline"
                              className="flex items-center gap-2 bg-transparent"
                          >
                            <Download className="h-4 w-4" />
                            Download Report
                          </Button>
                        </div>
                      </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
  )
}