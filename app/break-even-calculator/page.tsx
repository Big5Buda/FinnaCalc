"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Calculator, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function BreakEvenCalculator() {
  const router = useRouter()
  const [fixedCosts, setFixedCosts] = useState("")
  const [variableCostPerUnit, setVariableCostPerUnit] = useState("")
  const [pricePerUnit, setPricePerUnit] = useState("")
  const [salesMix, setSalesMix] = useState("single")
  const [seasonalityFactor, setSeasonalityFactor] = useState("0")
  const [targetProfitMargin, setTargetProfitMargin] = useState("20")
  const [result, setResult] = useState<any>(null)

  const calculateBreakEven = () => {
    const fixed = Number.parseFloat(fixedCosts) || 0
    const variableCost = Number.parseFloat(variableCostPerUnit) || 0
    const price = Number.parseFloat(pricePerUnit) || 0
    const seasonality = Number.parseFloat(seasonalityFactor) || 0
    const targetMargin = Number.parseFloat(targetProfitMargin) || 0

    if (price <= variableCost) {
      setResult({ error: "Selling price must be greater than variable cost per unit." })
      return
    }
    if (targetMargin >= 100) {
      setResult({ error: "Target profit margin must be less than 100%." })
      return
    }

    const contributionMargin = price - variableCost
    const contributionMarginRatio = (contributionMargin / price) * 100

    // Standard CVP break-even
    const breakEvenUnits = fixed / contributionMargin
    const breakEvenRevenue = breakEvenUnits * price

    // Units for target net profit margin on revenue (standard accounting definition)
    // Profit = (price - vc) * units - fixed = price * units * (margin / 100)
    // => units * (price - vc - price * margin/100) = fixed
    // => units * (price * (1 - margin/100) - vc) = fixed
    const adjustedCM = price * (1 - targetMargin / 100) - variableCost
    let unitsForTargetProfit = 0
    let targetProfitRevenueAmount = 0
    if (adjustedCM > 0) {
      unitsForTargetProfit = fixed / adjustedCM
      targetProfitRevenueAmount = unitsForTargetProfit * price
    }

    // Seasonality adjustments
    const seasonalFactor = 1 + seasonality / 100
    const seasonalBreakEven = breakEvenUnits * seasonalFactor
    const seasonalTargetUnits = unitsForTargetProfit * seasonalFactor

    // Margin of safety = how much above break-even the target is, as % of target
    const marginOfSafety = unitsForTargetProfit > 0
      ? ((unitsForTargetProfit - breakEvenUnits) / unitsForTargetProfit) * 100
      : 0

    setResult({
      breakEvenUnits: Math.ceil(breakEvenUnits),
      breakEvenRevenue,
      contributionMargin,
      contributionMarginRatio,
      unitsForTargetProfit: unitsForTargetProfit > 0 ? Math.ceil(unitsForTargetProfit) : null,
      targetProfitRevenue: targetProfitRevenueAmount,
      seasonalBreakEven: Math.ceil(seasonalBreakEven),
      seasonalTargetUnits: unitsForTargetProfit > 0 ? Math.ceil(seasonalTargetUnits) : null,
      marginOfSafety,
      adjustedCMValid: adjustedCM > 0,
    })
  }

  const unitLabel = salesMix === "service" ? "services" : "units"
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

  return (
    <div className="min-h-screen bg-muted/40">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <Button variant="outline" size="sm" onClick={() => router.back()} className="mb-6 flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-6 w-6 text-blue-600" />
              Break-Even Point Calculator
            </CardTitle>
            <CardDescription>Calculate how many {unitLabel} you need to sell to break even and hit profit targets</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="fixedCosts">Fixed Costs per Month ($)</Label>
                <Input id="fixedCosts" type="number" placeholder="10000" value={fixedCosts} onChange={(e) => setFixedCosts(e.target.value)} />
                <p className="text-xs text-muted-foreground mt-1">Rent, salaries, insurance, etc.</p>
              </div>
              <div>
                <Label htmlFor="variableCostPerUnit">Variable Cost per {salesMix === "service" ? "Service" : "Unit"} ($)</Label>
                <Input id="variableCostPerUnit" type="number" placeholder="25" value={variableCostPerUnit} onChange={(e) => setVariableCostPerUnit(e.target.value)} />
                <p className="text-xs text-muted-foreground mt-1">Materials, direct labor per unit</p>
              </div>
              <div>
                <Label htmlFor="pricePerUnit">Selling Price per {salesMix === "service" ? "Service" : "Unit"} ($)</Label>
                <Input id="pricePerUnit" type="number" placeholder="50" value={pricePerUnit} onChange={(e) => setPricePerUnit(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="salesMix">Business Type</Label>
                <Select value={salesMix} onValueChange={setSalesMix}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Single Product</SelectItem>
                    <SelectItem value="multiple">Multiple Products</SelectItem>
                    <SelectItem value="service">Service Business</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="targetProfitMargin">Target Net Profit Margin (%)</Label>
                <Input id="targetProfitMargin" type="number" placeholder="20" value={targetProfitMargin} onChange={(e) => setTargetProfitMargin(e.target.value)} />
                <p className="text-xs text-muted-foreground mt-1">% of revenue you want as net profit</p>
              </div>
              <div>
                <Label htmlFor="seasonalityFactor">Seasonality Adjustment (%)</Label>
                <Input id="seasonalityFactor" type="number" placeholder="0" value={seasonalityFactor} onChange={(e) => setSeasonalityFactor(e.target.value)} />
                <p className="text-xs text-muted-foreground mt-1">+ for peak season, − for off-season</p>
              </div>
            </div>

            <Button onClick={calculateBreakEven} className="w-full bg-blue-600 hover:bg-blue-700" size="lg">
              Calculate Break-Even Point
            </Button>

            {result && (
              <div className="space-y-4">
                {result.error ? (
                  <p className="text-sm text-destructive">{result.error}</p>
                ) : (
                  <>
                    <h3 className="text-lg font-semibold">Break-Even Analysis</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Break-Even {cap(unitLabel)}</p>
                        <p className="text-3xl font-bold text-green-600">
                          {result.breakEvenUnits.toLocaleString()} {unitLabel}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Break-Even Revenue</p>
                        <p className="text-2xl font-bold text-blue-600">
                          ${result.breakEvenRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Contribution Margin / unit</p>
                        <p className="text-2xl font-bold">${result.contributionMargin.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Contribution Margin Ratio</p>
                        <p className="text-2xl font-bold">{result.contributionMarginRatio.toFixed(1)}%</p>
                      </div>
                      {result.adjustedCMValid && result.unitsForTargetProfit && (
                        <>
                          <div>
                            <p className="text-sm text-muted-foreground">{cap(unitLabel)} for {targetProfitMargin}% Net Margin</p>
                            <p className="text-2xl font-bold text-purple-600">
                              {result.unitsForTargetProfit.toLocaleString()} {unitLabel}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Revenue for Target Margin</p>
                            <p className="text-2xl font-bold text-purple-600">
                              ${result.targetProfitRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Margin of Safety</p>
                            <p className="text-2xl font-bold text-orange-600">
                              {result.marginOfSafety.toFixed(1)}%
                            </p>
                          </div>
                        </>
                      )}
                      {Number.parseFloat(seasonalityFactor) !== 0 && (
                        <>
                          <div>
                            <p className="text-sm text-muted-foreground">Seasonal Break-Even</p>
                            <p className="text-2xl font-bold text-teal-600">
                              {result.seasonalBreakEven.toLocaleString()} {unitLabel}
                            </p>
                          </div>
                          {result.seasonalTargetUnits && (
                            <div>
                              <p className="text-sm text-muted-foreground">Seasonal Target {cap(unitLabel)}</p>
                              <p className="text-2xl font-bold text-teal-600">
                                {result.seasonalTargetUnits.toLocaleString()} {unitLabel}
                              </p>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    <div className="bg-muted/40 p-4 rounded-lg">
                      <p className="text-sm text-foreground/80">
                        You need to sell <strong>{result.breakEvenUnits.toLocaleString()} {unitLabel}</strong> to cover all fixed costs.
                        Each {salesMix === "service" ? "service" : "unit"} contributes{" "}
                        <strong>${result.contributionMargin.toFixed(2)}</strong> toward fixed costs ({result.contributionMarginRatio.toFixed(1)}% of price).
                        {result.adjustedCMValid && result.unitsForTargetProfit
                          ? ` To achieve a ${targetProfitMargin}% net profit margin, sell ${result.unitsForTargetProfit.toLocaleString()} ${unitLabel}.`
                          : ` Target margin is unachievable at this price and cost structure — reduce costs or raise price.`}
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
