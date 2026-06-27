"use client"

import { Calculator, TrendingUp, DollarSign, PieChart, Building2, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"

export default function HomePage() {
  const calculators = [
    {
      title: "Emergency Fund Calculator",
      description: "Calculate how much you need in your emergency fund and track progress toward your goal",
      icon: <DollarSign className="h-6 w-6" />,
      href: "/emergency-fund-calculator",
      category: "Personal Finance",
    },
    {
      title: "Break-Even Point Calculator",
      description: "Find out exactly how many units you need to sell to cover all costs and reach profitability",
      icon: <TrendingUp className="h-6 w-6" />,
      href: "/break-even-calculator",
      category: "Business",
    },
    {
      title: "Startup Cost Estimator",
      description: "Estimate total startup costs with industry templates and funding gap analysis",
      icon: <Building2 className="h-6 w-6" />,
      href: "/startup-cost-calculator",
      category: "Business",
    },
    {
      title: "Cash Flow Projector",
      description: "Project your business cash flow over time with growth rate modeling",
      icon: <TrendingUp className="h-6 w-6" />,
      href: "/cash-flow-calculator",
      category: "Business",
    },
    {
      title: "Loan Calculator",
      description: "Calculate payments, true APR, loan amounts, and remaining balances for any loan type",
      icon: <Calculator className="h-6 w-6" />,
      href: "/loan-calculator",
      category: "Loans",
    },
    {
      title: "Pricing Calculator",
      description: "Set the right price for your products and services with competitive analysis",
      icon: <DollarSign className="h-6 w-6" />,
      href: "/pricing-calculator",
      category: "Business",
    },
    {
      title: "ROI Calculator",
      description: "Calculate annualized return on investment with inflation and tax adjustments",
      icon: <PieChart className="h-6 w-6" />,
      href: "/roi-calculator",
      category: "Investment",
    },
    {
      title: "Tax Calculator",
      description: "Estimate 2024 federal taxes for individuals and self-employed businesses",
      icon: <Calculator className="h-6 w-6" />,
      href: "/tax-calculator",
      category: "Tax",
    },
    {
      title: "Employee vs Contractor Calculator",
      description: "Compare the true total cost of hiring employees versus independent contractors",
      icon: <Users className="h-6 w-6" />,
      href: "/employee-contractor-calculator",
      category: "Business",
    },
    {
      title: "Profit Margin Calculator",
      description: "Calculate gross, operating, and net profit margins with industry benchmarks",
      icon: <TrendingUp className="h-6 w-6" />,
      href: "/profit-margin-calculator",
      category: "Business",
    },
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/30 dark:to-background py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center">
            <h1 className="text-5xl font-bold text-foreground mb-6">
              Professional{" "}
              <span className="text-blue-600 dark:text-blue-400">Financial Calculators</span>{" "}
              and{" "}
              <span className="text-blue-600 dark:text-blue-400">Personal Finance</span>{" "}
              Tools
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
              Free, accurate, and easy-to-use financial calculators and personal finance planning tools for
              individuals, small business owners, and entrepreneurs.
            </p>
          </div>
        </div>
      </section>

      {/* Calculator Grid */}
      <section className="py-16 bg-muted/40" id="calculators">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">Choose Your Calculator</h2>
            <p className="text-lg text-muted-foreground">
              Professional financial tools to help you make better decisions
            </p>
          </div>
          <div className="grid grid-cols-3 gap-6">
            {calculators.map((calc, index) => (
              <Card key={index} className="transition-all duration-200 hover:shadow-lg hover:-translate-y-1 cursor-pointer">
                <Link href={calc.href}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-blue-100 dark:bg-blue-950/50 rounded-lg text-blue-600 dark:text-blue-400 flex-shrink-0">
                        {calc.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-base leading-tight">{calc.title}</CardTitle>
                        <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">{calc.category}</span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <CardDescription className="text-sm leading-relaxed">{calc.description}</CardDescription>
                  </CardContent>
                </Link>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 bg-background">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground">Why Choose FinnaCalc?</h2>
          </div>
          <div className="grid grid-cols-3 gap-8">
            {[
              {
                title: "All basic calculations are free",
                desc: "No hidden fees or premium requirements for essential financial calculations",
              },
              {
                title: "Accurate Results",
                desc: "Professional-grade calculations you can trust for important financial decisions",
              },
              {
                title: "AI-Powered Assistant",
                desc: "FinnaBot powered by Gemini answers your finance questions instantly",
              },
            ].map((f) => (
              <div key={f.title} className="flex items-start gap-3">
                <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-white text-sm">✓</span>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{f.title}</h3>
                  <p className="text-muted-foreground">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-blue-600">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to Take Control of Your Finances?</h2>
          <p className="text-xl text-blue-100 mb-8">
            Join thousands of business owners who trust FinnaCalc for their financial planning
          </p>
          <Link href="#calculators">
            <Button className="bg-background text-blue-600 hover:bg-muted px-8 py-3">
              Explore Our Calculators
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-4 gap-8">
            <div>
              <div className="flex items-center mb-4">
                <Calculator className="h-6 w-6 text-blue-400" />
                <span className="ml-2 text-lg font-bold">FinnaCalc</span>
              </div>
              <p className="text-gray-400">
                Professional financial calculators and planning tools for smart business decisions.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Calculators</h3>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/loan-calculator" className="hover:text-white">Loan Calculator</Link></li>
                <li><Link href="/roi-calculator" className="hover:text-white">ROI Calculator</Link></li>
                <li><Link href="/break-even-calculator" className="hover:text-white">Break-Even Calculator</Link></li>
                <li><Link href="/emergency-fund-calculator" className="hover:text-white">Emergency Fund</Link></li>
                <li><Link href="/tax-calculator" className="hover:text-white">Tax Calculator</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Business Tools</h3>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/startup-cost-calculator" className="hover:text-white">Startup Costs</Link></li>
                <li><Link href="/cash-flow-calculator" className="hover:text-white">Cash Flow</Link></li>
                <li><Link href="/pricing-calculator" className="hover:text-white">Pricing Calculator</Link></li>
                <li><Link href="/profit-margin-calculator" className="hover:text-white">Profit Margin</Link></li>
                <li><Link href="/employee-contractor-calculator" className="hover:text-white">Employee vs Contractor</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/about" className="hover:text-white">About Us</Link></li>
                <li><Link href="/privacy" className="hover:text-white">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-white">Terms of Service</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2024 FinnaCalc. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
