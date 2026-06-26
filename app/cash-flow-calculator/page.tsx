"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { TrendingUp, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function CashFlowCalculator() {
  const router = useRouter()
  const [monthlyRevenue, setMonthlyRevenue] = useState("")
  const [monthlyExpenses, setMonthlyExpenses] = useState("")
  const [startingCash, setStartingCash] = useState("")
  const [revenueGrowthRate, setRevenueGrowthRate] = useState("5")
  const [expenseGrowthRate, setExpenseGrowthRate] = useState("2")
  const [months, setMonths] = useState("12")
  const [result, setResult] = useState<any>(null)

  const calculateCashFlow = () => {
    const revenue = Number.parseFloat(monthlyRevenue) || 0
    const expenses = Number.parseFloat(monthlyExpenses) || 0
    const cash = Number.parseFloat(startingCash) || 0
    const revGrowth = Number.parseFloat(revenueGrowthRate) || 0
    const expGrowth = Number.parseFloat(expenseGrowthRate) || 0
    const period = Math.min(Math.max(Number.parseInt(months) || 12, 1), 60)

    const projections = []
    let currentCash = cash
    let currentRevenue = revenue
    let currentExpenses = expenses
    let breakEvenMonth: number | null = null

    for (let month = 1; month <= period; month++) {
      const netCashFlow = currentRevenue - currentExpenses
      currentCash += netCashFlow

      if (breakEvenMonth === null && currentCash >= 0 && (month === 1 ? cash < 0 : projections[projections.length - 1]?.cumulativeCash < 0)) {
        breakEvenMonth = month
      }

      projections.push({
        month,
        revenue: Math.round(currentRevenue),
        expenses: Math.round(currentExpenses),
        netCashFlow: Math.round(netCashFlow),
        cumulativeCash: Math.round(currentCash),
      })

      currentRevenue = currentRevenue * (1 + revGrowth / 100)
      currentExpenses = currentExpenses * (1 + expGrowth / 100)
    }

    const totalRevenue = projections.reduce((sum, p) => sum + p.revenue, 0)
    const totalExpenses = projections.reduce((sum, p) => sum + p.expenses, 0)
    const finalCash = projections[projections.length - 1]?.cumulativeCash || 0
    const negativeMonths = projections.filter((p) => p.cumulativeCash < 0).length

    setResult({
      projections,
      totalRevenue,
      totalExpenses,
      finalCash,
      netCashFlow: totalRevenue - totalExpenses,
      breakEvenMonth,
      negativeMonths,
    })
  }

  const fmtK = (n: number) =>
    Math.abs(n) >= 1000
      ? `${n < 0 ? "-" : ""}$${(Math.abs(n) / 1000).toFixed(1)}k`
      : `${n < 0 ? "-$" : "$"}${Math.abs(n).toLocaleString()}`

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
              Cash Flow Projector
            </CardTitle>
            <CardDescription>Project business cash flow with separate revenue and expense growth rates</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="monthlyRevenue">Starting Monthly Revenue ($)</Label>
                <Input id="monthlyRevenue" type="number" placeholder="25000" value={monthlyRevenue} onChange={(e) => setMonthlyRevenue(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="monthlyExpenses">Starting Monthly Expenses ($)</Label>
                <Input id="monthlyExpenses" type="number" placeholder="20000" value={monthlyExpenses} onChange={(e) => setMonthlyExpenses(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="startingCash">Starting Cash Balance ($)</Label>
                <Input id="startingCash" type="number" placeholder="50000" value={startingCash} onChange={(e) => setStartingCash(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="months">Projection Period (months)</Label>
                <Input id="months" type="number" placeholder="12" value={months} onChange={(e) => setMonths(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="revenueGrowthRate">Monthly Revenue Growth (%)</Label>
                <Input id="revenueGrowthRate" type="number" step="0.1" placeholder="5" value={revenueGrowthRate} onChange={(e) => setRevenueGrowthRate(e.target.value)} />
                <p className="text-xs text-muted-foreground mt-1">Month-over-month revenue growth rate</p>
              </div>
              <div>
                <Label htmlFor="expenseGrowthRate">Monthly Expense Growth (%)</Label>
                <Input id="expenseGrowthRate" type="number" step="0.1" placeholder="2" value={expenseGrowthRate} onChange={(e) => setExpenseGrowthRate(e.target.value)} />
                <p className="text-xs text-muted-foreground mt-1">Month-over-month expense growth rate</p>
              </div>
            </div>

            <Button onClick={calculateCashFlow} className="w-full bg-blue-600 hover:bg-blue-700" size="lg">
              Calculate Cash Flow Projection
            </Button>

            {result && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Cash Flow Projection</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Final Cash Balance</p>
                    <p className={`text-2xl font-bold ${result.finalCash >= 0 ? "text-green-600" : "text-red-600"}`}>
                      ${result.finalCash.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Revenue</p>
                    <p className="text-2xl font-bold text-blue-600">${result.totalRevenue.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Net Cash Flow</p>
                    <p className={`text-2xl font-bold ${result.netCashFlow >= 0 ? "text-green-600" : "text-red-600"}`}>
                      ${result.netCashFlow.toLocaleString()}
                    </p>
                  </div>
                </div>

                {result.negativeMonths > 0 && (
                  <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                    <p className="text-sm text-yellow-800 dark:text-yellow-300">
                      <strong>⚠ Cash runway warning:</strong> {result.negativeMonths} month{result.negativeMonths !== 1 ? "s" : ""} with negative cumulative cash balance.
                      {result.breakEvenMonth ? ` Cash turns positive in Month ${result.breakEvenMonth}.` : ""}
                    </p>
                  </div>
                )}

                <div className="bg-muted/40 p-4 rounded-lg max-h-72 overflow-y-auto">
                  <h4 className="font-semibold mb-3">Monthly Breakdown</h4>
                  <div className="grid grid-cols-4 gap-2 text-xs text-muted-foreground font-medium mb-2">
                    <span>Month</span>
                    <span>Revenue</span>
                    <span>Expenses</span>
                    <span>Cash Balance</span>
                  </div>
                  <div className="space-y-1 text-sm">
                    {result.projections.map((m: any) => (
                      <div key={m.month} className={`grid grid-cols-4 gap-2 py-0.5 border-b border-border/40 ${m.cumulativeCash < 0 ? "text-red-600" : ""}`}>
                        <span>Month {m.month}</span>
                        <span>{fmtK(m.revenue)}</span>
                        <span>{fmtK(m.expenses)}</span>
                        <span className={m.cumulativeCash < 0 ? "text-red-600 font-medium" : "text-green-600 font-medium"}>
                          {fmtK(m.cumulativeCash)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
