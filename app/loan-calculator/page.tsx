"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Calculator, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

/** True APR via Newton-Raphson — US Regulation Z method. */
function computeAPR(principal: number, interest: number, fees: number, termYears: number): number {
  const n = Math.round(termYears * 12)
  if (n <= 0 || principal <= 0) return 0
  const pmt = (principal + interest) / n
  const net = principal - fees
  if (net <= 0 || pmt <= 0) return 0

  let m = 0.005
  for (let i = 0; i < 300; i++) {
    const f = Math.pow(1 + m, -n)
    const pv = pmt * (1 - f) / m
    const dpv = pmt * (n * f * m / ((1 + m) * m) - (1 - f)) / (m * m)
    const dm = -(pv - net) / dpv
    m += dm
    if (!isFinite(m) || m <= 0) return 0
    if (Math.abs(dm) < 1e-10) break
  }
  return m * 12 * 100
}

const fmt = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function LoanCalculator() {
  const router = useRouter()
  const [calculationType, setCalculationType] = useState("payment")

  const [loanAmount, setLoanAmount] = useState("")
  const [interestRate, setInterestRate] = useState("")
  const [loanTerm, setLoanTerm] = useState("")
  const [loanType, setLoanType] = useState("personal")
  const [paymentFrequency, setPaymentFrequency] = useState("monthly")
  const [downPayment, setDownPayment] = useState("")

  const [loanAmountAPR, setLoanAmountAPR] = useState("")
  const [totalInterestInput, setTotalInterestInput] = useState("")
  const [fees, setFees] = useState("")
  const [termAPR, setTermAPR] = useState("")

  const [monthlyPayment, setMonthlyPayment] = useState("")
  const [rateForAmount, setRateForAmount] = useState("")
  const [termForAmount, setTermForAmount] = useState("")

  const [originalAmount, setOriginalAmount] = useState("")
  const [originalRate, setOriginalRate] = useState("")
  const [originalTerm, setOriginalTerm] = useState("")
  const [paymentsMade, setPaymentsMade] = useState("")

  const [result, setResult] = useState<any>(null)

  const handleTabChange = (value: string) => {
    setResult(null)
    setCalculationType(value)
  }

  const calculatePayment = () => {
    const principal = (Number.parseFloat(loanAmount) || 0) - (Number.parseFloat(downPayment) || 0)
    const annualRate = (Number.parseFloat(interestRate) || 0) / 100
    const termMonths = Number.parseFloat(loanTerm) || 0

    const freq: Record<string, { periods: number; termPeriods: number }> = {
      monthly: { periods: 12, termPeriods: termMonths },
      biweekly: { periods: 26, termPeriods: Math.round(termMonths * 26 / 12) },
      weekly: { periods: 52, termPeriods: Math.round(termMonths * 52 / 12) },
      quarterly: { periods: 4, termPeriods: Math.round(termMonths * 4 / 12) },
      annually: { periods: 1, termPeriods: Math.round(termMonths / 12) },
    }

    const { periods, termPeriods } = freq[paymentFrequency]
    const rate = annualRate / periods

    if (principal < 0 || termPeriods <= 0) {
      setResult({ error: "Please enter valid positive numbers for Loan Amount and Term." })
      return
    }

    let basePayment = 0
    if (rate === 0) {
      basePayment = termPeriods > 0 ? principal / termPeriods : 0
    } else {
      basePayment = (principal * rate * Math.pow(1 + rate, termPeriods)) / (Math.pow(1 + rate, termPeriods) - 1)
    }
    if (!isFinite(basePayment)) basePayment = 0

    setResult({
      type: "payment",
      basePayment,
      totalPayment: basePayment * termPeriods,
      totalInterest: basePayment * termPeriods - principal,
      principal,
    })
  }

  const calculateAPR = () => {
    const principal = Number.parseFloat(loanAmountAPR) || 0
    const interest = Number.parseFloat(totalInterestInput) || 0
    const totalFees = Number.parseFloat(fees) || 0
    const term = Number.parseFloat(termAPR) || 0

    if (principal <= 0 || term <= 0) {
      setResult({ error: "Please enter valid positive numbers" })
      return
    }

    const apr = computeAPR(principal, interest, totalFees, term)
    setResult({ type: "apr", apr, totalCost: interest + totalFees, principal, term })
  }

  const calculateLoanAmount = () => {
    const payment = Number.parseFloat(monthlyPayment) || 0
    const rate = (Number.parseFloat(rateForAmount) || 0) / 100 / 12
    const term = Number.parseFloat(termForAmount) || 0

    if (payment <= 0 || term <= 0) {
      setResult({ error: "Please enter valid positive numbers" })
      return
    }

    const maxLoan = rate === 0 ? payment * term : payment * ((1 - Math.pow(1 + rate, -term)) / rate)
    setResult({ type: "loanAmount", maxLoan, payment, term })
  }

  const calculateRemainingBalance = () => {
    const principal = Number.parseFloat(originalAmount) || 0
    const rate = (Number.parseFloat(originalRate) || 0) / 100 / 12
    const term = Number.parseFloat(originalTerm) || 0
    const payments = Number.parseFloat(paymentsMade) || 0

    if (principal <= 0 || term <= 0 || payments < 0) {
      setResult({ error: "Please enter valid positive numbers" })
      return
    }

    const pmt = rate === 0 ? principal / term : (principal * rate * Math.pow(1 + rate, term)) / (Math.pow(1 + rate, term) - 1)
    const balance = rate === 0
      ? principal - pmt * payments
      : principal * Math.pow(1 + rate, payments) - pmt * ((Math.pow(1 + rate, payments) - 1) / rate)

    setResult({
      type: "remaining",
      remainingBalance: Math.max(0, balance),
      remainingPayments: Math.max(0, term - payments),
      monthlyPayment: pmt,
      totalPaid: pmt * payments,
    })
  }

  const handleCalculate = () => {
    setResult(null)
    if (calculationType === "payment") calculatePayment()
    else if (calculationType === "apr") calculateAPR()
    else if (calculationType === "loanAmount") calculateLoanAmount()
    else calculateRemainingBalance()
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
              Loan Calculator
            </CardTitle>
            <CardDescription>
              Calculate payments, true APR (IRR method), loan amounts, and remaining balances
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={calculationType} onValueChange={handleTabChange} className="w-full">
              <TabsList className="grid w-full grid-cols-4 mb-6">
                <TabsTrigger value="payment">Payment</TabsTrigger>
                <TabsTrigger value="apr">True APR</TabsTrigger>
                <TabsTrigger value="loanAmount">Loan Amount</TabsTrigger>
                <TabsTrigger value="remaining">Remaining</TabsTrigger>
              </TabsList>

              <TabsContent value="payment" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="loanType">Loan Type</Label>
                    <Select value={loanType} onValueChange={setLoanType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="personal">Personal Loan</SelectItem>
                        <SelectItem value="business">Business Loan</SelectItem>
                        <SelectItem value="auto">Auto Loan</SelectItem>
                        <SelectItem value="mortgage">Mortgage</SelectItem>
                        <SelectItem value="student">Student Loan</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="loanAmount">Loan Amount ($)</Label>
                    <Input id="loanAmount" type="number" placeholder="50000" value={loanAmount} onChange={(e) => setLoanAmount(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="interestRate">Annual Interest Rate (%)</Label>
                    <Input id="interestRate" type="number" step="0.01" placeholder="5.5" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="loanTerm">Loan Term (months)</Label>
                    <Input id="loanTerm" type="number" placeholder="60" value={loanTerm} onChange={(e) => setLoanTerm(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="paymentFrequency">Payment Frequency</Label>
                    <Select value={paymentFrequency} onValueChange={setPaymentFrequency}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly (12/year)</SelectItem>
                        <SelectItem value="biweekly">Bi-weekly (26/year)</SelectItem>
                        <SelectItem value="weekly">Weekly (52/year)</SelectItem>
                        <SelectItem value="quarterly">Quarterly (4/year)</SelectItem>
                        <SelectItem value="annually">Annually (1/year)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="downPayment">Down Payment ($)</Label>
                    <Input id="downPayment" type="number" placeholder="0" value={downPayment} onChange={(e) => setDownPayment(e.target.value)} />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="apr" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="loanAmountAPR">Loan Amount ($)</Label>
                    <Input id="loanAmountAPR" type="number" placeholder="50000" value={loanAmountAPR} onChange={(e) => setLoanAmountAPR(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="totalInterestInput">Total Interest Paid ($)</Label>
                    <Input id="totalInterestInput" type="number" placeholder="5000" value={totalInterestInput} onChange={(e) => setTotalInterestInput(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="fees">Total Upfront Fees ($)</Label>
                    <Input id="fees" type="number" placeholder="500" value={fees} onChange={(e) => setFees(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="termAPR">Loan Term (years)</Label>
                    <Input id="termAPR" type="number" placeholder="5" value={termAPR} onChange={(e) => setTermAPR(e.target.value)} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  APR computed using Newton-Raphson IRR to match US Regulation Z — more accurate than the simple average-cost method.
                </p>
              </TabsContent>

              <TabsContent value="loanAmount" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="monthlyPayment">Monthly Payment ($)</Label>
                    <Input id="monthlyPayment" type="number" placeholder="500" value={monthlyPayment} onChange={(e) => setMonthlyPayment(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="rateForAmount">Annual Interest Rate (%)</Label>
                    <Input id="rateForAmount" type="number" step="0.01" placeholder="5.5" value={rateForAmount} onChange={(e) => setRateForAmount(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="termForAmount">Loan Term (months)</Label>
                    <Input id="termForAmount" type="number" placeholder="60" value={termForAmount} onChange={(e) => setTermForAmount(e.target.value)} />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="remaining" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="originalAmount">Original Loan Amount ($)</Label>
                    <Input id="originalAmount" type="number" placeholder="50000" value={originalAmount} onChange={(e) => setOriginalAmount(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="originalRate">Annual Interest Rate (%)</Label>
                    <Input id="originalRate" type="number" step="0.01" placeholder="5.5" value={originalRate} onChange={(e) => setOriginalRate(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="originalTerm">Original Term (months)</Label>
                    <Input id="originalTerm" type="number" placeholder="60" value={originalTerm} onChange={(e) => setOriginalTerm(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="paymentsMade">Payments Made</Label>
                    <Input id="paymentsMade" type="number" placeholder="12" value={paymentsMade} onChange={(e) => setPaymentsMade(e.target.value)} />
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <Button onClick={handleCalculate} className="w-full bg-blue-600 hover:bg-blue-700 mt-6" size="lg">
              Calculate{" "}
              {calculationType === "payment" ? "Payment"
                : calculationType === "apr" ? "True APR"
                : calculationType === "loanAmount" ? "Loan Amount"
                : "Remaining Balance"}
            </Button>

            {result && (
              <div className="space-y-4 mt-6">
                {result.error ? (
                  <p className="text-sm text-destructive">{result.error}</p>
                ) : (
                  <>
                    <h3 className="text-lg font-semibold">Results</h3>

                    {result.type === "payment" && calculationType === "payment" && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Payment per Period</p>
                          <p className="text-3xl font-bold text-green-600">${fmt(result.basePayment)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Total Amount Paid</p>
                          <p className="text-2xl font-bold">${fmt(result.totalPayment)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Total Interest Cost</p>
                          <p className="text-2xl font-bold text-red-600">${fmt(result.totalInterest)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Principal Financed</p>
                          <p className="text-2xl font-bold">${result.principal.toLocaleString()}</p>
                        </div>
                      </div>
                    )}

                    {result.type === "apr" && calculationType === "apr" && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">True APR (incl. fees)</p>
                          <p className="text-3xl font-bold text-green-600">{result.apr.toFixed(3)}%</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Total Loan Cost</p>
                          <p className="text-2xl font-bold text-red-600">${result.totalCost.toLocaleString()}</p>
                        </div>
                      </div>
                    )}

                    {result.type === "loanAmount" && calculationType === "loanAmount" && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Maximum Loan Amount</p>
                          <p className="text-3xl font-bold text-green-600">${fmt(result.maxLoan)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Monthly Payment</p>
                          <p className="text-2xl font-bold">${result.payment.toLocaleString()}</p>
                        </div>
                      </div>
                    )}

                    {result.type === "remaining" && calculationType === "remaining" && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Remaining Balance</p>
                          <p className="text-3xl font-bold text-green-600">${fmt(result.remainingBalance)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Payments Remaining</p>
                          <p className="text-2xl font-bold">{result.remainingPayments}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Total Paid So Far</p>
                          <p className="text-2xl font-bold">${fmt(result.totalPaid)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Monthly Payment</p>
                          <p className="text-2xl font-bold">${fmt(result.monthlyPayment)}</p>
                        </div>
                      </div>
                    )}
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
