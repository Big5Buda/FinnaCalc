"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { TrendingUp, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function ProfitMarginCalculator() {
  const router = useRouter()
  const [revenue, setRevenue] = useState("")
  const [costOfGoodsSold, setCostOfGoodsSold] = useState("")
  const [operatingExpenses, setOperatingExpenses] = useState("")
  const [interestExpenses, setInterestExpenses] = useState("")
  const [taxExpenses, setTaxExpenses] = useState("")
  const [result, setResult] = useState<any>(null)

  const calculateProfitMargin = () => {
    const totalRevenue = Number.parseFloat(revenue) || 0
    const cogs = Number.parseFloat(costOfGoodsSold) || 0
    const opex = Number.parseFloat(operatingExpenses) || 0
    const interest = Number.parseFloat(interestExpenses) || 0
    const taxes = Number.parseFloat(taxExpenses) || 0

    if (totalRevenue <= 0) {
      setResult({ error: "Revenue must be greater than 0." })
      return
    }

    const grossProfit = totalRevenue - cogs
    const operatingIncome = grossProfit - opex
    const ebt = operatingIncome - interest
    const netProfit = ebt - taxes

    setResult({
      totalRevenue,
      grossProfit,
      operatingIncome,
      ebt,
      netProfit,
      grossMargin: (grossProfit / totalRevenue) * 100,
      operatingMargin: (operatingIncome / totalRevenue) * 100,
      ebtMargin: (ebt / totalRevenue) * 100,
      netMargin: (netProfit / totalRevenue) * 100,
      cogs,
      opex,
      interest,
      taxes,
    })
  }

  const pct = (n: number) => `${n.toFixed(2)}%`
  const dollar = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  const color = (n: number) => n >= 0 ? "text-green-600" : "text-red-600"

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
              Profit Margin Calculator
            </CardTitle>
            <CardDescription>
              Calculate gross, operating, EBT, and net profit margins with a full income statement breakdown
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="revenue">Total Revenue ($)</Label>
                <Input id="revenue" type="number" placeholder="100000" value={revenue} onChange={(e) => setRevenue(e.target.value)} />
                <p className="text-xs text-muted-foreground mt-1">Total sales revenue for the period</p>
              </div>
              <div>
                <Label htmlFor="costOfGoodsSold">Cost of Goods Sold (COGS) ($)</Label>
                <Input id="costOfGoodsSold" type="number" placeholder="60000" value={costOfGoodsSold} onChange={(e) => setCostOfGoodsSold(e.target.value)} />
                <p className="text-xs text-muted-foreground mt-1">Direct costs to produce goods/services</p>
              </div>
              <div>
                <Label htmlFor="operatingExpenses">Operating Expenses ($)</Label>
                <Input id="operatingExpenses" type="number" placeholder="20000" value={operatingExpenses} onChange={(e) => setOperatingExpenses(e.target.value)} />
                <p className="text-xs text-muted-foreground mt-1">Rent, salaries, marketing, G&A</p>
              </div>
              <div>
                <Label htmlFor="interestExpenses">Interest Expenses ($)</Label>
                <Input id="interestExpenses" type="number" placeholder="2000" value={interestExpenses} onChange={(e) => setInterestExpenses(e.target.value)} />
                <p className="text-xs text-muted-foreground mt-1">Loan interest and financing costs</p>
              </div>
              <div>
                <Label htmlFor="taxExpenses">Income Tax Expense ($)</Label>
                <Input id="taxExpenses" type="number" placeholder="3000" value={taxExpenses} onChange={(e) => setTaxExpenses(e.target.value)} />
                <p className="text-xs text-muted-foreground mt-1">Actual taxes paid this period</p>
              </div>
            </div>

            <Button onClick={calculateProfitMargin} className="w-full bg-blue-600 hover:bg-blue-700" size="lg">
              Calculate Profit Margins
            </Button>

            {result && (
              <div className="space-y-4">
                {result.error ? (
                  <p className="text-sm text-destructive">{result.error}</p>
                ) : (
                  <>
                    <h3 className="text-lg font-semibold">Profit Margin Analysis</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Gross Profit Margin</p>
                        <p className={`text-3xl font-bold ${color(result.grossMargin)}`}>{pct(result.grossMargin)}</p>
                        <p className="text-sm text-muted-foreground">{dollar(result.grossProfit)} gross profit</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Operating Margin (EBIT)</p>
                        <p className={`text-2xl font-bold ${color(result.operatingMargin)}`}>{pct(result.operatingMargin)}</p>
                        <p className="text-sm text-muted-foreground">{dollar(result.operatingIncome)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Pre-Tax Margin (EBT)</p>
                        <p className={`text-2xl font-bold ${color(result.ebtMargin)}`}>{pct(result.ebtMargin)}</p>
                        <p className="text-sm text-muted-foreground">{dollar(result.ebt)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Net Profit Margin</p>
                        <p className={`text-2xl font-bold ${color(result.netMargin)}`}>{pct(result.netMargin)}</p>
                        <p className="text-sm text-muted-foreground">{dollar(result.netProfit)}</p>
                      </div>
                    </div>

                    <div className="bg-muted/40 p-4 rounded-lg">
                      <h4 className="font-semibold mb-3">Income Statement</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Revenue</span>
                          <span className="font-semibold">{dollar(result.totalRevenue)}</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>− COGS</span>
                          <span>({dollar(result.cogs)})</span>
                        </div>
                        <div className="flex justify-between border-t pt-1">
                          <span className="font-medium">Gross Profit</span>
                          <span className={`font-semibold ${color(result.grossProfit)}`}>{dollar(result.grossProfit)}</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>− Operating Expenses</span>
                          <span>({dollar(result.opex)})</span>
                        </div>
                        <div className="flex justify-between border-t pt-1">
                          <span className="font-medium">Operating Income (EBIT)</span>
                          <span className={`font-semibold ${color(result.operatingIncome)}`}>{dollar(result.operatingIncome)}</span>
                        </div>
                        {result.interest > 0 && (
                          <div className="flex justify-between text-muted-foreground">
                            <span>− Interest Expenses</span>
                            <span>({dollar(result.interest)})</span>
                          </div>
                        )}
                        {(result.interest > 0 || result.taxes > 0) && (
                          <div className="flex justify-between border-t pt-1">
                            <span className="font-medium">Pre-Tax Income (EBT)</span>
                            <span className={`font-semibold ${color(result.ebt)}`}>{dollar(result.ebt)}</span>
                          </div>
                        )}
                        {result.taxes > 0 && (
                          <div className="flex justify-between text-muted-foreground">
                            <span>− Income Tax</span>
                            <span>({dollar(result.taxes)})</span>
                          </div>
                        )}
                        <div className="flex justify-between border-t pt-1">
                          <span className="font-semibold">Net Profit</span>
                          <span className={`font-bold ${color(result.netProfit)}`}>{dollar(result.netProfit)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-muted/40 p-4 rounded-lg">
                      <h4 className="font-semibold mb-2">Industry Benchmarks</h4>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        {[
                          { name: "Retail", gross: "20–50%", net: "2–6%" },
                          { name: "Software / SaaS", gross: "70–90%", net: "15–25%" },
                          { name: "Restaurant", gross: "60–70%", net: "3–7%" },
                          { name: "Manufacturing", gross: "25–40%", net: "5–10%" },
                          { name: "Consulting", gross: "60–75%", net: "15–25%" },
                          { name: "E-commerce", gross: "30–50%", net: "3–8%" },
                        ].map((b) => (
                          <div key={b.name}>
                            <p className="font-medium">{b.name}</p>
                            <p className="text-muted-foreground">Gross: {b.gross}</p>
                            <p className="text-muted-foreground">Net: {b.net}</p>
                          </div>
                        ))}
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
