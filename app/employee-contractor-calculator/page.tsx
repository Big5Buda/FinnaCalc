"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Users, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const SS_WAGE_BASE_2024 = 168600

export default function EmployeeContractorCalculator() {
  const router = useRouter()
  const [salary, setSalary] = useState("")
  const [contractorRate, setContractorRate] = useState("")
  const [hoursPerWeek, setHoursPerWeek] = useState("40")
  const [weeksPerYear, setWeeksPerYear] = useState("50")
  const [result, setResult] = useState<any>(null)

  const calculateComparison = () => {
    const annualSalary = Number.parseFloat(salary) || 0
    const hourlyRate = Number.parseFloat(contractorRate) || 0
    const hours = Number.parseFloat(hoursPerWeek) || 40
    const weeks = Number.parseFloat(weeksPerYear) || 50

    if (annualSalary <= 0 || hourlyRate <= 0) {
      setResult({ error: "Please enter valid salary and hourly rate values." })
      return
    }

    // Employer payroll taxes (2024)
    const ssSalary = Math.min(annualSalary, SS_WAGE_BASE_2024)
    const employerSS = ssSalary * 0.062                     // Social Security: 6.2% up to $168,600
    const employerMedicare = annualSalary * 0.0145           // Medicare: 1.45% (no cap)
    const ficaTotal = employerSS + employerMedicare

    // FUTA (net after standard 5.4% state credit): 0.6% on first $7,000
    const futaNet = Math.min(annualSalary, 7000) * 0.006     // = $42 max
    // SUTA varies by state; use 2% estimate as common midpoint
    const suta = Math.min(annualSalary, 7000) * 0.02          // ≈ $140 max

    // Workers' compensation (2% of salary, industry average)
    const workersComp = annualSalary * 0.02

    // Benefits breakdown (employer costs, 2024 estimates)
    const healthDentalVision = Math.min(annualSalary * 0.12, 10800)  // ~$9k median employer health cost
    const retirement401k = annualSalary * 0.03              // 3% match (common baseline)
    const ptoValue = annualSalary * (15 / 260)              // 15 PTO days ≈ 5.77% of salary
    const otherBenefits = annualSalary * 0.02               // Life/disability/misc
    const totalBenefits = healthDentalVision + retirement401k + ptoValue + otherBenefits

    const totalEmployeeCost =
      annualSalary + totalBenefits + ficaTotal + workersComp + futaNet + suta

    const contractorAnnualCost = hourlyRate * hours * weeks
    const contractorEquivalentHourly = totalEmployeeCost / (hours * weeks)

    const savings = totalEmployeeCost - contractorAnnualCost
    const savingsPercentage = totalEmployeeCost > 0 ? (savings / totalEmployeeCost) * 100 : 0

    setResult({
      employee: {
        salary: annualSalary,
        healthDentalVision,
        retirement401k,
        ptoValue,
        otherBenefits,
        totalBenefits,
        employerSS,
        employerMedicare,
        ficaTotal,
        futaNet,
        suta,
        workersComp,
        totalCost: totalEmployeeCost,
        burdenRate: ((totalEmployeeCost - annualSalary) / annualSalary) * 100,
      },
      contractor: {
        hourlyRate,
        annualCost: contractorAnnualCost,
        equivalentHourly: contractorEquivalentHourly,
      },
      savings,
      savingsPercentage,
      recommendation: savings > 0 ? "contractor" : "employee",
    })
  }

  const dollar = (n: number) => `$${Math.round(n).toLocaleString()}`

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
              <Users className="h-6 w-6 text-blue-600" />
              Employee vs Contractor Calculator
            </CardTitle>
            <CardDescription>
              Compare the true total cost of employees vs contractors using 2024 tax rates and benefit benchmarks
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="salary">Employee Annual Salary ($)</Label>
                <Input id="salary" type="number" placeholder="60000" value={salary} onChange={(e) => setSalary(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="contractorRate">Contractor Hourly Rate ($)</Label>
                <Input id="contractorRate" type="number" placeholder="40" value={contractorRate} onChange={(e) => setContractorRate(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="hoursPerWeek">Hours per Week</Label>
                <Input id="hoursPerWeek" type="number" placeholder="40" value={hoursPerWeek} onChange={(e) => setHoursPerWeek(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="weeksPerYear">Weeks per Year</Label>
                <Input id="weeksPerYear" type="number" placeholder="50" value={weeksPerYear} onChange={(e) => setWeeksPerYear(e.target.value)} />
              </div>
            </div>

            <Button onClick={calculateComparison} className="w-full bg-blue-600 hover:bg-blue-700" size="lg">
              Compare Costs
            </Button>

            {result && (
              <div className="space-y-4">
                {result.error ? (
                  <p className="text-sm text-destructive">{result.error}</p>
                ) : (
                  <>
                    <h3 className="text-lg font-semibold">Cost Comparison</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Employee Cost</p>
                        <p className="text-3xl font-bold text-red-600">{dollar(result.employee.totalCost)}</p>
                        <p className="text-xs text-muted-foreground">+{result.employee.burdenRate.toFixed(0)}% burden above salary</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Total Contractor Cost</p>
                        <p className="text-3xl font-bold text-blue-600">{dollar(result.contractor.annualCost)}</p>
                        <p className="text-xs text-muted-foreground">${result.contractor.hourlyRate}/hr × {hoursPerWeek}h × {weeksPerYear}wks</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          {result.savings > 0 ? "Contractor Saves" : "Employee Saves"}
                        </p>
                        <p className={`text-2xl font-bold ${result.savings > 0 ? "text-green-600" : "text-orange-600"}`}>
                          {dollar(Math.abs(result.savings))} / yr
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {Math.abs(result.savingsPercentage).toFixed(1)}% {result.savings > 0 ? "cheaper" : "more expensive"} vs employee
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Equivalent Employee Hourly Rate</p>
                        <p className="text-2xl font-bold">${result.contractor.equivalentHourly.toFixed(2)}/hr</p>
                        <p className="text-xs text-muted-foreground">Total employee cost ÷ total hours</p>
                      </div>
                    </div>

                    <Tabs defaultValue="employee" className="w-full">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="employee">Employee Breakdown</TabsTrigger>
                        <TabsTrigger value="contractor">Contractor Details</TabsTrigger>
                      </TabsList>

                      <TabsContent value="employee" className="space-y-3 mt-4">
                        <div className="bg-muted/40 p-4 rounded-lg">
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between font-medium">
                              <span>Base Salary</span>
                              <span>{dollar(result.employee.salary)}</span>
                            </div>
                            <div className="text-muted-foreground font-medium pt-2">Benefits:</div>
                            <div className="flex justify-between pl-4"><span>Health / Dental / Vision</span><span>{dollar(result.employee.healthDentalVision)}</span></div>
                            <div className="flex justify-between pl-4"><span>401(k) Match (3%)</span><span>{dollar(result.employee.retirement401k)}</span></div>
                            <div className="flex justify-between pl-4"><span>PTO Value (15 days)</span><span>{dollar(result.employee.ptoValue)}</span></div>
                            <div className="flex justify-between pl-4"><span>Life / Disability / Other</span><span>{dollar(result.employee.otherBenefits)}</span></div>
                            <div className="flex justify-between border-t pt-1"><span>Total Benefits</span><span>{dollar(result.employee.totalBenefits)}</span></div>
                            <div className="text-muted-foreground font-medium pt-2">Employer Taxes (2024):</div>
                            <div className="flex justify-between pl-4"><span>Social Security (6.2%, up to $168,600)</span><span>{dollar(result.employee.employerSS)}</span></div>
                            <div className="flex justify-between pl-4"><span>Medicare (1.45%)</span><span>{dollar(result.employee.employerMedicare)}</span></div>
                            <div className="flex justify-between pl-4"><span>FUTA (net 0.6% on first $7k)</span><span>{dollar(result.employee.futaNet)}</span></div>
                            <div className="flex justify-between pl-4"><span>SUTA (est. 2% on first $7k)</span><span>{dollar(result.employee.suta)}</span></div>
                            <div className="flex justify-between pl-4"><span>Workers Comp (est. 2%)</span><span>{dollar(result.employee.workersComp)}</span></div>
                            <div className="flex justify-between border-t pt-2 font-semibold text-base">
                              <span>Total Employer Cost</span>
                              <span>{dollar(result.employee.totalCost)}</span>
                            </div>
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="contractor" className="space-y-3 mt-4">
                        <div className="bg-muted/40 p-4 rounded-lg">
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between"><span>Hourly Rate</span><span>${result.contractor.hourlyRate}/hr</span></div>
                            <div className="flex justify-between"><span>Annual Hours ({hoursPerWeek}h × {weeksPerYear}wks)</span><span>{(Number(hoursPerWeek) * Number(weeksPerYear)).toLocaleString()} hrs</span></div>
                            <div className="flex justify-between border-t pt-2 font-semibold"><span>Annual Contractor Cost</span><span>{dollar(result.contractor.annualCost)}</span></div>
                            <p className="text-xs text-muted-foreground pt-2">
                              No payroll taxes, benefits, or workers comp required. Contractor is responsible for their own SE tax, insurance, and retirement.
                            </p>
                          </div>
                        </div>
                        <div className={`p-4 rounded-lg ${result.recommendation === "contractor" ? "bg-green-50 dark:bg-green-950/20" : "bg-blue-50 dark:bg-blue-950/20"}`}>
                          <p className="text-sm font-medium">Recommendation</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {result.recommendation === "contractor"
                              ? `Hiring a contractor saves ${dollar(result.savings)} per year (${result.savingsPercentage.toFixed(1)}%). Best for short-term, specialized, or variable-hour work.`
                              : `An employee is ${dollar(Math.abs(result.savings))} cheaper per year at this rate. Better for long-term, high-commitment roles with training investment.`}
                          </p>
                        </div>
                      </TabsContent>
                    </Tabs>
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
