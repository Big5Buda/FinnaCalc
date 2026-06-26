"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Share2, Download, DollarSign, TrendingUp, Calculator, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"

export default function PricingCalculator() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("service")

  // Service Pricing States
  const [hourlyRate, setHourlyRate] = useState("")
  const [hoursPerWeek, setHoursPerWeek] = useState("")
  const [weeksPerYear, setWeeksPerYear] = useState("50")
  const [expenses, setExpenses] = useState("")
  const [profitMargin, setProfitMargin] = useState("20")
  const [desiredSalary, setDesiredSalary] = useState("")
  const [taxRate, setTaxRate] = useState("25")
  const [industryType, setIndustryType] = useState("")

  // Product Pricing States
  const [productCost, setProductCost] = useState("")
  const [productMargin, setProductMargin] = useState("50")
  const [competitorPrice, setCompetitorPrice] = useState("")
  const [volumeDiscount, setVolumeDiscount] = useState("")
  const [shippingCost, setShippingCost] = useState("")

  const [result, setResult] = useState<any>(null)

  const handleTabChange = (value: string) => {
    setResult(null);
    setActiveTab(value);
  };

  // **FIX**: Added more industry options
  const industryBenchmarks : {[key:string]: any} = {
    consulting: { hourlyRange: [75, 200], profitMargin: 25 },
    design: { hourlyRange: [50, 150], profitMargin: 30 },
    development: { hourlyRange: [60, 180], profitMargin: 35 },
    marketing: { hourlyRange: [40, 120], profitMargin: 28 },
    legal: { hourlyRange: [150, 500], profitMargin: 40 },
    accounting: { hourlyRange: [50, 150], profitMargin: 30 },
    coaching: { hourlyRange: [75, 300], profitMargin: 45 },
    freelance: { hourlyRange: [25, 100], profitMargin: 20 },
    healthcare: { hourlyRange: [80, 250], profitMargin: 20 },
    trades: { hourlyRange: [45, 120], profitMargin: 25 },
    realestate: { hourlyRange: [50, 150], profitMargin: 30 },
    education: { hourlyRange: [30, 100], profitMargin: 20 },
    other: { hourlyRange: [20, 80], profitMargin: 15 },
  }

  const calculateServicePricing = () => {
    setResult(null);
    const rate = Number.parseFloat(hourlyRate) || 0
    const hours = Number.parseFloat(hoursPerWeek) || 0
    const weeks = Number.parseFloat(weeksPerYear) || 50
    const annualExpenses = Number.parseFloat(expenses) || 0
    const margin = Number.parseFloat(profitMargin) || 20
    const salary = Number.parseFloat(desiredSalary) || 0
    const tax = Number.parseFloat(taxRate) || 25

    const totalBillableHours = hours * weeks
    const annualRevenue = rate * totalBillableHours
    const grossProfit = annualRevenue - annualExpenses
    const netIncome = grossProfit * (1 - tax / 100)

    const requiredGrossIncome = salary / (1 - tax / 100)
    const requiredRevenue = requiredGrossIncome + annualExpenses
    const requiredHourlyRate = totalBillableHours > 0 ? requiredRevenue / totalBillableHours : 0;

    const breakEvenRate = totalBillableHours > 0 ? annualExpenses / totalBillableHours : 0;

    const industryData = industryType ? industryBenchmarks[industryType] : null
    const isCompetitive = industryData
        ? rate >= industryData.hourlyRange[0] && rate <= industryData.hourlyRange[1]
        : null

    const scenarios = [
      { name: "Conservative", rate: rate * 0.8, description: "20% below current rate" },
      { name: "Current", rate: rate, description: "Your current rate" },
      { name: "Optimistic", rate: rate * 1.2, description: "20% above current rate" },
      { name: "Premium", rate: rate * 1.5, description: "50% premium pricing" },
    ].map((scenario) => ({
      ...scenario,
      annualRevenue: scenario.rate * totalBillableHours,
      netIncome: (scenario.rate * totalBillableHours - annualExpenses) * (1 - tax / 100),
    }))

    setResult({
      type: "service",
      annualRevenue,
      netIncome,
      grossProfit,
      requiredHourlyRate,
      breakEvenRate,
      currentRate: rate,
      totalHours: totalBillableHours,
      effectiveHourlyRate: totalBillableHours > 0 ? netIncome / totalBillableHours : 0,
      industryData,
      isCompetitive,
      scenarios,
      profitMarginActual: annualRevenue > 0 ? (grossProfit / annualRevenue) * 100 : 0,
    })
  }

  const calculateProductPricing = () => {
    setResult(null);
    const cost = Number.parseFloat(productCost) || 0
    const margin = Number.parseFloat(productMargin) || 50
    const competitor = Number.parseFloat(competitorPrice) || 0
    const discount = Number.parseFloat(volumeDiscount) || 0
    const shipping = Number.parseFloat(shippingCost) || 0

    if (margin >= 100) {
      setResult({ error: "Profit margin must be less than 100%" });
      return;
    }
    if (cost < 0) {
      setResult({ error: "Product cost cannot be negative." });
      return;
    }

    const sellingPrice = cost > 0 ? cost / (1 - margin / 100) : 0;
    const profit = sellingPrice - cost
    const markupPercentage = cost > 0 ? (profit / cost) * 100 : 0;

    const totalPrice = sellingPrice + shipping
    const netProfit = profit - shipping

    const volumePrice = sellingPrice * (1 - discount / 100)
    const volumeProfit = volumePrice - cost

    const competitiveAdvantage = competitor > 0 ? ((competitor - sellingPrice) / competitor) * 100 : 0

    const strategies = [
      { name: "Cost-Plus", price: sellingPrice, description: "Standard markup pricing" },
      { name: "Competitive", price: competitor * 0.95, description: "5% below competitor" },
      { name: "Premium", price: sellingPrice * 1.3, description: "30% premium positioning" },
      { name: "Penetration", price: sellingPrice * 0.8, description: "20% below standard for market entry" },
    ]
        .filter((strategy) => strategy.price > 0)
        .map((strategy) => ({
          ...strategy,
          profit: strategy.price - cost,
          margin: strategy.price > 0 ? ((strategy.price - cost) / strategy.price) * 100 : 0,
        }))

    setResult({
      type: "product",
      cost,
      sellingPrice,
      profit,
      markupPercentage,
      marginPercentage: margin,
      totalPrice,
      netProfit,
      volumePrice,
      volumeProfit,
      competitiveAdvantage,
      strategies,
    })
  }

  const shareResults = () => {
    if (result) {
      const shareText =
          result.type === "service"
              ? `My recommended hourly rate: $${result.requiredHourlyRate.toFixed(2)} for ${result.totalHours} annual hours. Calculate yours at ${window.location.href}`
              : `My product pricing: $${result.sellingPrice.toFixed(2)} with ${result.marginPercentage}% margin. Calculate yours at ${window.location.href}`

      if (navigator.share) {
        navigator.share({
          title: "Pricing Calculator Results",
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
        type: result.type,
        calculatedAt: new Date().toISOString(),
        ...result,
      }

      const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `pricing-report-${Date.now()}.json`
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
                    <DollarSign className="h-6 w-6 text-blue-600" />
                    Advanced Pricing Calculator
                  </CardTitle>
                  <CardDescription>Strategic pricing with competitive analysis and industry benchmarks</CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="service">Service Pricing</TabsTrigger>
                      <TabsTrigger value="product">Product Pricing</TabsTrigger>
                    </TabsList>

                    <TabsContent value="service" className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="industryType">Industry Type</Label>
                          <Select value={industryType} onValueChange={setIndustryType}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select your industry" />
                            </SelectTrigger>
                            <SelectContent>
                              {/* **FIX**: Added more options */}
                              <SelectItem value="consulting">Consulting</SelectItem>
                              <SelectItem value="design">Design & Creative</SelectItem>
                              <SelectItem value="development">Software Development</SelectItem>
                              <SelectItem value="marketing">Marketing & Advertising</SelectItem>
                              <SelectItem value="legal">Legal Services</SelectItem>
                              <SelectItem value="accounting">Accounting & Finance</SelectItem>
                              <SelectItem value="coaching">Coaching & Training</SelectItem>
                              <SelectItem value="healthcare">Healthcare & Wellness</SelectItem>
                              <SelectItem value="trades">Trades (Plumbing, Electrical, etc.)</SelectItem>
                              <SelectItem value="realestate">Real Estate</SelectItem>
                              <SelectItem value="education">Education & Tutoring</SelectItem>
                              <SelectItem value="freelance">General Freelance</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="hourlyRate">Current Hourly Rate ($)</Label>
                          <Input
                              id="hourlyRate"
                              type="number"
                              placeholder="75"
                              value={hourlyRate}
                              onChange={(e) => setHourlyRate(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="hoursPerWeek">Billable Hours per Week</Label>
                          <Input
                              id="hoursPerWeek"
                              type="number"
                              placeholder="30"
                              value={hoursPerWeek}
                              onChange={(e) => setHoursPerWeek(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="weeksPerYear">Working Weeks per Year</Label>
                          <Input
                              id="weeksPerYear"
                              type="number"
                              placeholder="50"
                              value={weeksPerYear}
                              onChange={(e) => setWeeksPerYear(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="expenses">Annual Business Expenses ($)</Label>
                          <Input
                              id="expenses"
                              type="number"
                              placeholder="25000"
                              value={expenses}
                              onChange={(e) => setExpenses(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="desiredSalary">Desired Annual Salary ($)</Label>
                          <Input
                              id="desiredSalary"
                              type="number"
                              placeholder="80000"
                              value={desiredSalary}
                              onChange={(e) => setDesiredSalary(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="taxRate">Tax Rate (%)</Label>
                          <Input
                              id="taxRate"
                              type="number"
                              placeholder="25"
                              value={taxRate}
                              onChange={(e) => setTaxRate(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="profitMargin">Target Profit Margin (%)</Label>
                          <Input
                              id="profitMargin"
                              type="number"
                              placeholder="20"
                              value={profitMargin}
                              onChange={(e) => setProfitMargin(e.target.value)}
                          />
                        </div>
                      </div>

                      <Button
                          onClick={calculateServicePricing}
                          className="w-full bg-blue-600 hover:bg-blue-700"
                          size="lg"
                      >
                        <Calculator className="h-4 w-4 mr-2" />
                        Calculate Advanced Service Pricing
                      </Button>
                    </TabsContent>

                    <TabsContent value="product" className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="productCost">Product Cost ($)</Label>
                          <Input
                              id="productCost"
                              type="number"
                              placeholder="25"
                              value={productCost}
                              onChange={(e) => setProductCost(e.target.value)}
                          />
                          <p className="text-xs text-muted-foreground mt-1">Total cost to make/acquire</p>
                        </div>
                        <div>
                          <Label htmlFor="productMargin">Desired Profit Margin (%)</Label>
                          <Input
                              id="productMargin"
                              type="number"
                              placeholder="50"
                              value={productMargin}
                              onChange={(e) => setProductMargin(e.target.value)}
                          />
                          <p className="text-xs text-muted-foreground mt-1">Percentage of selling price</p>
                        </div>
                        <div>
                          <Label htmlFor="competitorPrice">Competitor Price ($)</Label>
                          <Input
                              id="competitorPrice"
                              type="number"
                              placeholder="60"
                              value={competitorPrice}
                              onChange={(e) => setCompetitorPrice(e.target.value)}
                          />
                          <p className="text-xs text-muted-foreground mt-1">For competitive analysis</p>
                        </div>
                        <div>
                          <Label htmlFor="shippingCost">Shipping Cost ($)</Label>
                          <Input
                              id="shippingCost"
                              type="number"
                              placeholder="5"
                              value={shippingCost}
                              onChange={(e) => setShippingCost(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="volumeDiscount">Volume Discount (%)</Label>
                          <Input
                              id="volumeDiscount"
                              type="number"
                              placeholder="10"
                              value={volumeDiscount}
                              onChange={(e) => setVolumeDiscount(e.target.value)}
                          />
                          <p className="text-xs text-muted-foreground mt-1">For bulk orders</p>
                        </div>
                      </div>

                      <Button
                          onClick={calculateProductPricing}
                          className="w-full bg-blue-600 hover:bg-blue-700"
                          size="lg"
                      >
                        <Calculator className="h-4 w-4 mr-2" />
                        Calculate Advanced Product Pricing
                      </Button>
                    </TabsContent>
                  </Tabs>

                  {result && (
                      <div className="calculator-result space-y-6 mt-6">
                        {result.error ? (
                            <div className="text-red-600 font-semibold p-4 bg-red-50 border border-red-200 rounded-lg">
                              {result.error}
                            </div>
                        ) : (
                            <>
                              <h3 className="text-lg font-semibold text-blue-800 flex items-center gap-2">
                                <TrendingUp className="h-5 w-5" />
                                Your {result.type === "service" ? "Service" : "Product"} Pricing Analysis
                              </h3>

                              {result.type === "service" && activeTab === "service" ? (
                                  <>
                                    <div className="grid grid-cols-4 gap-4">
                                      <div>
                                        <p className="text-sm text-muted-foreground">Current Annual Revenue</p>
                                        <p className="text-2xl font-bold text-green-600">
                                          ${result.annualRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-sm text-muted-foreground">Net Income (After Tax)</p>
                                        <p
                                            className={`text-2xl font-bold ${result.netIncome >= 0 ? "text-blue-600" : "text-red-600"}`}
                                        >
                                          ${result.netIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-sm text-muted-foreground">Required Hourly Rate</p>
                                        <p className="text-2xl font-bold text-purple-600">
                                          ${result.requiredHourlyRate.toFixed(2)}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-sm text-muted-foreground">Break-Even Rate</p>
                                        <p className="text-2xl font-bold text-orange-600">${result.breakEvenRate.toFixed(2)}</p>
                                      </div>
                                    </div>

                                    {result.industryData && (
                                        <div className="bg-blue-50 p-4 rounded-lg">
                                          <h4 className="font-semibold mb-2">Industry Benchmark Analysis</h4>
                                          <div className="flex items-center justify-between">
                                      <span>
                                        Industry Range: ${result.industryData.hourlyRange[0]} - $
                                        {result.industryData.hourlyRange[1]}
                                      </span>
                                            <span
                                                className={`px-2 py-1 rounded text-sm ${result.isCompetitive ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}
                                            >
                                        {result.isCompetitive ? "Competitive" : "Outside Range"}
                                      </span>
                                          </div>
                                          <Progress
                                              value={Math.min((result.currentRate / result.industryData.hourlyRange[1]) * 100, 100)}
                                              className="mt-2"
                                          />
                                        </div>
                                    )}

                                    <div className="bg-muted/40 p-4 rounded-lg">
                                      <h4 className="font-semibold mb-3">Pricing Scenarios:</h4>
                                      <div className="space-y-3">
                                        {result.scenarios.map((scenario: any, index: number) => (
                                            <div key={index} className="flex items-center justify-between p-2 bg-background rounded">
                                              <div>
                                                <span className="font-medium">{scenario.name}</span>
                                                <span className="text-sm text-muted-foreground ml-2">${scenario.rate.toFixed(2)}/hr</span>
                                              </div>
                                              <div className="text-right">
                                                <div className="font-semibold">${scenario.annualRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                                <div
                                                    className={`text-sm ${scenario.netIncome >= 0 ? "text-green-600" : "text-red-600"}`}
                                                >
                                                  Net: ${scenario.netIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </div>
                                              </div>
                                            </div>
                                        ))}
                                      </div>
                                    </div>
                                  </>
                              ) : result.type === "product" && activeTab === "product" ? (
                                  <>
                                    <div className="grid grid-cols-4 gap-4">
                                      <div>
                                        <p className="text-sm text-muted-foreground">Recommended Selling Price</p>
                                        <p className="text-2xl font-bold text-green-600">${result.sellingPrice.toFixed(2)}</p>
                                      </div>
                                      <div>
                                        <p className="text-sm text-muted-foreground">Profit per Unit</p>
                                        <p className="text-2xl font-bold text-blue-600">${result.profit.toFixed(2)}</p>
                                      </div>
                                      <div>
                                        <p className="text-sm text-muted-foreground">Markup Percentage</p>
                                        <p className="text-2xl font-bold text-purple-600">{result.markupPercentage.toFixed(1)}%</p>
                                      </div>
                                      <div>
                                        <p className="text-sm text-muted-foreground">Profit Margin</p>
                                        <p className="text-2xl font-bold text-orange-600">{result.marginPercentage}%</p>
                                      </div>
                                    </div>

                                    {result.competitiveAdvantage !== 0 && (
                                        <div className="bg-blue-50 p-4 rounded-lg">
                                          <h4 className="font-semibold mb-2">Competitive Analysis</h4>
                                          <p className={`${result.competitiveAdvantage > 0 ? "text-green-600" : "text-red-600"}`}>
                                            Your price is {Math.abs(result.competitiveAdvantage).toFixed(1)}%
                                            {result.competitiveAdvantage > 0 ? " below" : " above"} competitor pricing
                                          </p>
                                        </div>
                                    )}

                                    <div className="bg-muted/40 p-4 rounded-lg">
                                      <h4 className="font-semibold mb-3">Pricing Strategies:</h4>
                                      <div className="space-y-3">
                                        {result.strategies.map((strategy: any, index: number) => (
                                            <div key={index} className="flex items-center justify-between p-2 bg-background rounded">
                                              <div>
                                                <span className="font-medium">{strategy.name}</span>
                                                <span className="text-sm text-muted-foreground ml-2">{strategy.description}</span>
                                              </div>
                                              <div className="text-right">
                                                <div className="font-semibold">${strategy.price.toFixed(2)}</div>
                                                <div className="text-sm text-green-600">
                                                  Profit: ${strategy.profit.toFixed(2)} ({strategy.margin.toFixed(1)}%)
                                                </div>
                                              </div>
                                            </div>
                                        ))}
                                      </div>
                                    </div>
                                  </>
                              ): null}

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
                                  Download Analysis
                                </Button>
                              </div>
                            </>
                        )}
                      </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* SEO Content */}
          <div className="mt-12 prose max-w-none">
            <h2>Strategic Pricing for Business Success</h2>
            <p>
              Pricing is one of the most critical decisions for any business. Our advanced pricing calculator goes beyond
              simple cost-plus calculations to provide strategic insights including industry benchmarks, competitive
              analysis, and scenario planning.
            </p>

            <h3>Service Pricing Strategies</h3>
            <ul>
              <li>
                <strong>Value-Based Pricing:</strong> Price based on value delivered to clients
              </li>
              <li>
                <strong>Competitive Pricing:</strong> Price relative to industry standards
              </li>
              <li>
                <strong>Cost-Plus Pricing:</strong> Add a markup to your costs and expenses
              </li>
              <li>
                <strong>Premium Positioning:</strong> Higher prices for specialized expertise
              </li>
            </ul>

            <h3>Product Pricing Considerations</h3>
            <p>
              When pricing products, consider manufacturing costs, overhead, desired profit margins, competitor pricing,
              and perceived value. Our calculator helps you analyze multiple pricing strategies to find the optimal
              approach for your market position.
            </p>
          </div>
        </div>
      </div>
  )
}