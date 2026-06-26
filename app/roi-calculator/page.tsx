"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { TrendingUp, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function ROICalculator() {
  const router = useRouter()
  const [initialInvestment, setInitialInvestment] = useState("")
  const [finalValue, setFinalValue] = useState("")
  const [timeHorizon, setTimeHorizon] = useState("")
  const [calculationType, setCalculationType] = useState("annualized")
  const [investmentType, setInvestmentType] = useState("stocks")
  const [dividendYield, setDividendYield] = useState("0")
  const [inflationRate, setInflationRate] = useState("3.0")
  const [taxRate, setTaxRate] = useState("20")
  const [result, setResult] = useState<any>(null)

  const calculateROI = () => {
    const initial = Number.parseFloat(initialInvestment) || 0
    const final = Number.parseFloat(finalValue) || 0
    const time = Number.parseFloat(timeHorizon) || 1
    const dividend = Number.parseFloat(dividendYield) || 0
    const inflation = Number.parseFloat(inflationRate) || 0
    const tax = Number.parseFloat(taxRate) || 0

    if (initial <= 0) {
      setResult({ error: "Initial investment must be greater than 0" })
      return
    }

    const totalReturn = final - initial
    const simpleROI = (totalReturn / initial) * 100

    // CAGR — correct annualized ROI
    const cagr = time > 0 ? (Math.pow(final / initial, 1 / time) - 1) * 100 : simpleROI

    const displayedROI = calculationType === "annualized" ? cagr : simpleROI

    // Dividend income
    const annualDividendIncome = initial * (dividend / 100)
    const totalDividendIncome = annualDividendIncome * time

    // After-tax returns
    const capitalGainsTax = totalReturn > 0 ? totalReturn * (tax / 100) : 0
    const dividendTax = totalDividendIncome * (tax / 100)
    const afterTaxReturn = totalReturn + totalDividendIncome - capitalGainsTax - dividendTax

    // Fisher equation for real ROI (inflation-adjusted) — more accurate than simple subtraction
    const realROI = ((1 + cagr / 100) / (1 + inflation / 100) - 1) * 100
    const realValue = initial * Math.pow(1 + realROI / 100, time)

    setResult({
      totalReturn,
      simpleROI,
      cagr,
      displayedROI,
      initial,
      final,
      time,
      dividendIncome: totalDividendIncome,
      afterTaxReturn,
      realROI,
      realValue,
      totalTaxes: capitalGainsTax + dividendTax,
    })
  }

  const fmt2 = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

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
              <TrendingUp className="h-6 w-6 text-blue-600" />
              Return on Investment (ROI) Calculator
            </CardTitle>
            <CardDescription>Calculate the return on your investments and business projects</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="calculationType">Calculation Type</Label>
                <Select value={calculationType} onValueChange={setCalculationType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="simple">Simple ROI (total %)</SelectItem>
                    <SelectItem value="annualized">Annualized ROI / CAGR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="investmentType">Investment Type</Label>
                <Select value={investmentType} onValueChange={setInvestmentType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stocks">Stocks / ETFs</SelectItem>
                    <SelectItem value="realestate">Real Estate</SelectItem>
                    <SelectItem value="business">Business Investment</SelectItem>
                    <SelectItem value="bonds">Bonds</SelectItem>
                    <SelectItem value="crypto">Cryptocurrency</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="initialInvestment">Initial Investment ($)</Label>
                <Input id="initialInvestment" type="number" placeholder="10000" value={initialInvestment} onChange={(e) => setInitialInvestment(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="finalValue">Final Value ($)</Label>
                <Input id="finalValue" type="number" placeholder="15000" value={finalValue} onChange={(e) => setFinalValue(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="timeHorizon">Time Period (years)</Label>
                <Input id="timeHorizon" type="number" step="0.1" placeholder="5" value={timeHorizon} onChange={(e) => setTimeHorizon(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="dividendYield">Annual Dividend / Income Yield (%)</Label>
                <Input id="dividendYield" type="number" step="0.01" placeholder="2.0" value={dividendYield} onChange={(e) => setDividendYield(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="inflationRate">Expected Inflation Rate (%)</Label>
                <Input id="inflationRate" type="number" step="0.01" placeholder="3.0" value={inflationRate} onChange={(e) => setInflationRate(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="taxRate">Tax Rate on Gains (%)</Label>
                <Input id="taxRate" type="number" step="0.01" placeholder="20" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
              </div>
            </div>

            <Button onClick={calculateROI} className="w-full bg-blue-600 hover:bg-blue-700" size="lg">
              Calculate ROI
            </Button>

            {result && (
              <div className="space-y-4">
                {result.error ? (
                  <p className="text-sm text-destructive">{result.error}</p>
                ) : (
                  <>
                    <h3 className="text-lg font-semibold">ROI Analysis</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">
                          {calculationType === "annualized" ? "CAGR (Annualized ROI)" : "Simple ROI (Total)"}
                        </p>
                        <p className={`text-3xl font-bold ${result.displayedROI >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {result.displayedROI.toFixed(2)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Total Return</p>
                        <p className={`text-2xl font-bold ${result.totalReturn >= 0 ? "text-green-600" : "text-red-600"}`}>
                          ${result.totalReturn.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Real ROI (inflation-adjusted, Fisher eq.)</p>
                        <p className={`text-2xl font-bold ${result.realROI >= 0 ? "text-blue-600" : "text-red-600"}`}>
                          {result.realROI.toFixed(2)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">After-Tax Return</p>
                        <p className={`text-2xl font-bold ${result.afterTaxReturn >= 0 ? "text-blue-600" : "text-red-600"}`}>
                          ${fmt2(result.afterTaxReturn)}
                        </p>
                      </div>
                    </div>

                    <div className="bg-muted/40 p-4 rounded-lg">
                      <h4 className="font-semibold mb-3">Full Summary</h4>
                      <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-muted-foreground">Initial Investment</span><span className="font-semibold">${result.initial.toLocaleString()}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Final Value</span><span className="font-semibold">${result.final.toLocaleString()}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Dividend Income</span><span className="font-semibold">${fmt2(result.dividendIncome)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Total Taxes</span><span className="font-semibold text-red-600">${fmt2(result.totalTaxes)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Real Value (today's $)</span><span className="font-semibold">${fmt2(result.realValue)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Investment Period</span><span className="font-semibold">{result.time} yr{result.time !== 1 ? "s" : ""}</span></div>
                      </div>
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
