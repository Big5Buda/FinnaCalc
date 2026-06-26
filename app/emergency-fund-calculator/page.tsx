"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Calculator, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function EmergencyFundCalculator() {
  const router = useRouter()
  const [monthlyExpenses, setMonthlyExpenses] = useState("")
  const [currentSavings, setCurrentSavings] = useState("")
  const [targetType, setTargetType] = useState("months")
  const [targetValue, setTargetValue] = useState("6")
  const [monthlySavings, setMonthlySavings] = useState("")
  const [interestRate, setInterestRate] = useState("4.5")
  const [savingsGoal, setSavingsGoal] = useState("emergency")
  const [result, setResult] = useState<any>(null)

  const calculateEmergencyFund = () => {
    const expenses = Number.parseFloat(monthlyExpenses) || 0
    const savings = Number.parseFloat(currentSavings) || 0
    const value = Number.parseFloat(targetValue) || 0
    const monthlyContribution = Number.parseFloat(monthlySavings) || 0
    const rate = Number.parseFloat(interestRate) || 0

    if (expenses <= 0) {
      setResult({ error: "Monthly expenses must be greater than 0." })
      return
    }

    const targetAmount = targetType === "months" ? expenses * value : value
    const stillNeeded = Math.max(0, targetAmount - savings)
    const percentComplete = targetAmount > 0 ? Math.min(100, (savings / targetAmount) * 100) : 0

    // Time to reach goal with compound interest (solve for n in FV-of-annuity)
    let timeToGoal = 0
    let projectedInterest = 0
    if (stillNeeded > 0 && monthlyContribution > 0) {
      const monthlyRate = rate / 100 / 12
      if (monthlyRate > 0) {
        // log(1 + stillNeeded * r / PMT) / log(1 + r)
        timeToGoal = Math.log(1 + (stillNeeded * monthlyRate) / monthlyContribution) / Math.log(1 + monthlyRate)
      } else {
        timeToGoal = stillNeeded / monthlyContribution
      }
      timeToGoal = Math.ceil(timeToGoal)
      // Interest earned = total FV minus total contributions
      // FV ≈ stillNeeded (by definition), total contributions = PMT * timeToGoal
      projectedInterest = Math.max(0, stillNeeded - monthlyContribution * timeToGoal)
    }

    setResult({
      targetAmount,
      currentSavings: savings,
      stillNeeded,
      percentComplete,
      monthsOfExpensesCovered: expenses > 0 ? savings / expenses : 0,
      timeToGoal,
      monthlyContribution,
      projectedInterest,
      targetMonths: targetType === "months" ? value : (expenses > 0 ? targetAmount / expenses : 0),
    })
  }

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
              Emergency Fund Calculator
            </CardTitle>
            <CardDescription>
              Calculate your emergency fund target and how long it will take to reach it
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="monthlyExpenses">Monthly Expenses ($)</Label>
                <Input id="monthlyExpenses" type="number" placeholder="5000" value={monthlyExpenses} onChange={(e) => setMonthlyExpenses(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="currentSavings">Current Emergency Savings ($)</Label>
                <Input id="currentSavings" type="number" placeholder="0" value={currentSavings} onChange={(e) => setCurrentSavings(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="targetType">Target Type</Label>
                <Select value={targetType} onValueChange={setTargetType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="months">Months of Expenses</SelectItem>
                    <SelectItem value="amount">Specific Dollar Amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="targetValue">
                  {targetType === "months" ? "Number of Months" : "Target Amount ($)"}
                </Label>
                <Input
                  id="targetValue"
                  type="number"
                  placeholder={targetType === "months" ? "6" : "30000"}
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {targetType === "months" ? "Recommended: 3–6 months for most people" : "Enter your desired fund total"}
                </p>
              </div>
              <div>
                <Label htmlFor="monthlySavings">Monthly Savings Contribution ($)</Label>
                <Input id="monthlySavings" type="number" placeholder="500" value={monthlySavings} onChange={(e) => setMonthlySavings(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="interestRate">Savings Account APY (%)</Label>
                <Input id="interestRate" type="number" step="0.01" placeholder="4.5" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} />
                <p className="text-xs text-muted-foreground mt-1">HYSAs currently offer 4–5% APY</p>
              </div>
              <div>
                <Label htmlFor="savingsGoal">Goal Type</Label>
                <Select value={savingsGoal} onValueChange={setSavingsGoal}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="emergency">Emergency Fund</SelectItem>
                    <SelectItem value="vacation">Vacation Fund</SelectItem>
                    <SelectItem value="home">Home Down Payment</SelectItem>
                    <SelectItem value="car">Car Purchase</SelectItem>
                    <SelectItem value="other">Other Goal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button onClick={calculateEmergencyFund} className="w-full bg-blue-600 hover:bg-blue-700" size="lg">
              Calculate Emergency Fund
            </Button>

            {result && (
              <div className="space-y-4">
                {result.error ? (
                  <p className="text-sm text-destructive">{result.error}</p>
                ) : (
                  <>
                    <h3 className="text-lg font-semibold">Emergency Fund Analysis</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Target Emergency Fund</p>
                        <p className="text-3xl font-bold text-green-600">${result.targetAmount.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">{result.targetMonths.toFixed(1)} months of expenses</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Still Need to Save</p>
                        <p className="text-2xl font-bold text-red-600">${result.stillNeeded.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Progress</p>
                        <p className="text-2xl font-bold text-blue-600">{result.percentComplete.toFixed(1)}%</p>
                        <div className="mt-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-blue-600 rounded-full" style={{ width: `${result.percentComplete}%` }} />
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Current Coverage</p>
                        <p className="text-2xl font-bold">{result.monthsOfExpensesCovered.toFixed(1)} months</p>
                      </div>
                      {result.monthlyContribution > 0 && result.stillNeeded > 0 && (
                        <>
                          <div>
                            <p className="text-sm text-muted-foreground">Time to Goal</p>
                            <p className="text-2xl font-bold text-orange-600">
                              {result.timeToGoal} month{result.timeToGoal !== 1 ? "s" : ""}
                              {result.timeToGoal >= 12 && ` (${(result.timeToGoal / 12).toFixed(1)} yrs)`}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Interest Earned</p>
                            <p className="text-2xl font-bold text-green-600">
                              ${result.projectedInterest.toFixed(2)}
                            </p>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="bg-muted/40 p-4 rounded-lg">
                      <h4 className="font-semibold mb-2">Tips</h4>
                      <ul className="text-sm space-y-1 text-muted-foreground">
                        <li>• Keep your fund in a high-yield savings account (HYSA)</li>
                        <li>• Automate monthly contributions to stay consistent</li>
                        <li>• Only use it for true emergencies — job loss, medical, car</li>
                        <li>• Replenish it immediately after any withdrawal</li>
                        <li>• Start with a $1,000 starter fund if your goal feels far away</li>
                      </ul>
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
