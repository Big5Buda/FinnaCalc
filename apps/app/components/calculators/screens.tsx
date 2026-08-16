"use client"

import { useState } from "react"
import { calculatorBySlug, type CalculatorSlug } from "@/lib/calculators/catalog"
import * as Calc from "@/lib/calculators/math"
import { calcValue, currency } from "@/lib/format"
import {
    CurrencyField,
    FieldGrid,
    PercentField,
    SectionCard,
    SegmentedControl,
    SegmentedField,
    SelectField,
    StepperField,
} from "@/components/calculators/controls"
import { CalculatorScreen } from "@/components/calculators/screen"

/**
 * The eleven calculator screens, each a port of its Features/Calculators/*.swift
 * counterpart: same fields, same defaults, same section grouping, same hints.
 */

function useReveal() {
    const [revealed, setRevealed] = useState(false)
    return { revealed, reveal: () => setRevealed(true) }
}

// MARK: - Emergency fund

function EmergencyFundScreen() {
    const entry = calculatorBySlug("emergency-fund")!
    const { revealed, reveal } = useReveal()
    const [monthlyExpenses, setMonthlyExpenses] = useState("")
    const [currentSavings, setCurrentSavings] = useState("")
    const [targetType, setTargetType] = useState<"months" | "dollar">("months")
    const [months, setMonths] = useState("6")
    const [dollarAmount, setDollarAmount] = useState("")
    const [contribution, setContribution] = useState("")
    const [apy, setApy] = useState("")

    const results = Calc.emergencyFund({
        monthlyExpenses: calcValue(monthlyExpenses),
        currentSavings: calcValue(currentSavings),
        targetType,
        months: calcValue(months),
        dollarAmount: calcValue(dollarAmount),
        contribution: calcValue(contribution),
        apy: calcValue(apy),
    })

    return (
        <CalculatorScreen
            entry={entry}
            verb="Emergency Fund"
            revealed={revealed}
            onCalculate={reveal}
            results={results}
        >
            <SectionCard label="Your situation">
                <FieldGrid>
                    <CurrencyField label="Monthly Expenses" value={monthlyExpenses} onChange={setMonthlyExpenses} />
                    <CurrencyField
                        label="Current Emergency Savings"
                        value={currentSavings}
                        onChange={setCurrentSavings}
                    />
                </FieldGrid>
            </SectionCard>
            <SectionCard label="Your goal">
                <div className="flex flex-col gap-4">
                    <SegmentedField
                        label="Target Type"
                        value={targetType}
                        onChange={setTargetType}
                        options={[
                            { value: "months", label: "Months" },
                            { value: "dollar", label: "$ Amount" },
                        ]}
                    />
                    <FieldGrid>
                        {targetType === "months" ? (
                            <StepperField
                                label="Number of Months"
                                value={months}
                                onChange={setMonths}
                                min={1}
                                unit="mo"
                                hint="How many months of expenses to save. 3–6 is typical; 6–12 if your income is variable."
                            />
                        ) : (
                            <CurrencyField
                                label="Target Dollar Amount"
                                value={dollarAmount}
                                onChange={setDollarAmount}
                            />
                        )}
                    </FieldGrid>
                </div>
            </SectionCard>
            <SectionCard label="Savings plan">
                <FieldGrid>
                    <CurrencyField
                        label="Monthly Savings Contribution"
                        value={contribution}
                        onChange={setContribution}
                    />
                    <PercentField
                        label="Savings Account APY"
                        value={apy}
                        onChange={setApy}
                        hint="Your savings account’s annual percentage yield. Higher APY grows your fund faster."
                    />
                </FieldGrid>
            </SectionCard>
        </CalculatorScreen>
    )
}

// MARK: - Compound interest

function CompoundInterestScreen() {
    const entry = calculatorBySlug("compound-interest")!
    const { revealed, reveal } = useReveal()
    const [initialDeposit, setInitialDeposit] = useState("")
    const [monthlyContribution, setMonthlyContribution] = useState("")
    const [rate, setRate] = useState("")
    const [years, setYears] = useState("10")

    const results = Calc.compoundInterest({
        initialDeposit: calcValue(initialDeposit),
        monthlyContribution: calcValue(monthlyContribution),
        annualRate: calcValue(rate),
        years: calcValue(years),
    })

    return (
        <CalculatorScreen entry={entry} verb="Growth" revealed={revealed} onCalculate={reveal} results={results}>
            <SectionCard label="Starting point">
                <FieldGrid>
                    <CurrencyField label="Initial Deposit" value={initialDeposit} onChange={setInitialDeposit} />
                    <CurrencyField
                        label="Monthly Contribution"
                        value={monthlyContribution}
                        onChange={setMonthlyContribution}
                    />
                </FieldGrid>
            </SectionCard>
            <SectionCard label="Growth">
                <FieldGrid>
                    <PercentField label="Annual Interest Rate" value={rate} onChange={setRate} />
                    <StepperField label="Time Period" value={years} onChange={setYears} min={1} unit="yr" />
                </FieldGrid>
            </SectionCard>
        </CalculatorScreen>
    )
}

// MARK: - Retirement / 401(k)

function RetirementScreen() {
    const entry = calculatorBySlug("retirement")!
    const { revealed, reveal } = useReveal()
    const [currentAge, setCurrentAge] = useState("30")
    const [retirementAge, setRetirementAge] = useState("65")
    const [currentBalance, setCurrentBalance] = useState("")
    const [annualSalary, setAnnualSalary] = useState("")
    const [contributionPct, setContributionPct] = useState("")
    const [employerMatchRate, setEmployerMatchRate] = useState("")
    const [employerMatchCap, setEmployerMatchCap] = useState("")
    const [annualReturn, setAnnualReturn] = useState("")

    const results = Calc.retirement({
        currentAge: calcValue(currentAge),
        retirementAge: calcValue(retirementAge),
        currentBalance: calcValue(currentBalance),
        annualSalary: calcValue(annualSalary),
        contributionPct: calcValue(contributionPct),
        employerMatchRate: calcValue(employerMatchRate),
        employerMatchCapPct: calcValue(employerMatchCap),
        annualReturn: calcValue(annualReturn),
    })

    return (
        <CalculatorScreen
            entry={entry}
            verb="Retirement Balance"
            revealed={revealed}
            onCalculate={reveal}
            results={results}
        >
            <SectionCard label="Your info">
                <FieldGrid>
                    <StepperField label="Current Age" value={currentAge} onChange={setCurrentAge} min={16} unit="yrs" />
                    <StepperField
                        label="Retirement Age"
                        value={retirementAge}
                        onChange={setRetirementAge}
                        min={17}
                        unit="yrs"
                    />
                </FieldGrid>
            </SectionCard>
            <SectionCard label="Contributions">
                <FieldGrid>
                    <CurrencyField
                        label="Current 401(k) Balance"
                        value={currentBalance}
                        onChange={setCurrentBalance}
                    />
                    <CurrencyField label="Annual Salary" value={annualSalary} onChange={setAnnualSalary} />
                    <PercentField
                        label="Your Contribution"
                        value={contributionPct}
                        onChange={setContributionPct}
                        hint="The percent of your salary you contribute each year."
                    />
                    <PercentField
                        label="Employer Match Rate"
                        value={employerMatchRate}
                        onChange={setEmployerMatchRate}
                        hint="How much of your contribution your employer matches — e.g. 50% means they add 50¢ per dollar you contribute."
                    />
                    <PercentField
                        label="Employer Match Cap"
                        value={employerMatchCap}
                        onChange={setEmployerMatchCap}
                        hint="The most your employer matches, as a percent of salary — e.g. a 6% cap stops matching contributions beyond 6% of pay."
                    />
                </FieldGrid>
            </SectionCard>
            <SectionCard label="Growth">
                <FieldGrid>
                    <PercentField
                        label="Expected Annual Return"
                        value={annualReturn}
                        onChange={setAnnualReturn}
                    />
                </FieldGrid>
            </SectionCard>
        </CalculatorScreen>
    )
}

// MARK: - ROI

function ROIScreen() {
    const entry = calculatorBySlug("roi")!
    const { revealed, reveal } = useReveal()
    const [initial, setInitial] = useState("")
    const [final, setFinal] = useState("")
    const [years, setYears] = useState("3")
    const [inflation, setInflation] = useState("")
    const [taxRate, setTaxRate] = useState("")

    const results = Calc.roi({
        initial: calcValue(initial),
        final: calcValue(final),
        years: calcValue(years),
        inflation: calcValue(inflation),
        taxRate: calcValue(taxRate),
    })

    return (
        <CalculatorScreen entry={entry} verb="ROI" revealed={revealed} onCalculate={reveal} results={results}>
            <SectionCard label="Investment">
                <FieldGrid>
                    <CurrencyField label="Initial Investment" value={initial} onChange={setInitial} />
                    <CurrencyField label="Final Value" value={final} onChange={setFinal} />
                </FieldGrid>
            </SectionCard>
            <SectionCard label="Timeframe">
                <FieldGrid>
                    <StepperField label="Investment Period" value={years} onChange={setYears} min={1} unit="yr" />
                </FieldGrid>
            </SectionCard>
            <SectionCard label="Adjustments">
                <FieldGrid>
                    <PercentField
                        label="Annual Inflation Rate"
                        value={inflation}
                        onChange={setInflation}
                        hint="Used to show your return in today’s purchasing power."
                    />
                    <PercentField label="Tax Rate on Gains" value={taxRate} onChange={setTaxRate} />
                </FieldGrid>
            </SectionCard>
        </CalculatorScreen>
    )
}

// MARK: - Profit margin

function ProfitMarginScreen() {
    const entry = calculatorBySlug("profit-margin")!
    const { revealed, reveal } = useReveal()
    const [revenue, setRevenue] = useState("")
    const [cogs, setCogs] = useState("")
    const [opex, setOpex] = useState("")
    const [taxRate, setTaxRate] = useState("")

    const results = Calc.profitMargin({
        revenue: calcValue(revenue),
        cogs: calcValue(cogs),
        opex: calcValue(opex),
        taxRate: calcValue(taxRate),
    })

    return (
        <CalculatorScreen
            entry={entry}
            verb="Profit Margin"
            revealed={revealed}
            onCalculate={reveal}
            results={results}
        >
            <SectionCard label="Revenue & costs">
                <FieldGrid>
                    <CurrencyField label="Revenue" value={revenue} onChange={setRevenue} />
                    <CurrencyField label="Cost of Goods Sold" value={cogs} onChange={setCogs} />
                </FieldGrid>
            </SectionCard>
            <SectionCard label="Expenses & tax">
                <FieldGrid>
                    <CurrencyField label="Operating Expenses" value={opex} onChange={setOpex} />
                    <PercentField
                        label="Tax Rate"
                        value={taxRate}
                        onChange={setTaxRate}
                        hint="Applied to net profit to estimate your after-tax take-home."
                    />
                </FieldGrid>
            </SectionCard>
        </CalculatorScreen>
    )
}

// MARK: - Break-even

function BreakEvenScreen() {
    const entry = calculatorBySlug("break-even")!
    const { revealed, reveal } = useReveal()
    const [fixedCosts, setFixedCosts] = useState("")
    const [variableCost, setVariableCost] = useState("")
    const [price, setPrice] = useState("")
    const [businessType, setBusinessType] = useState<"single" | "multi">("single")
    const [targetMargin, setTargetMargin] = useState("")
    const [seasonality, setSeasonality] = useState("")

    const results = Calc.breakEven({
        fixedCosts: calcValue(fixedCosts),
        variableCost: calcValue(variableCost),
        price: calcValue(price),
        businessType,
        targetMargin: calcValue(targetMargin),
        seasonality: calcValue(seasonality),
    })

    return (
        <CalculatorScreen
            entry={entry}
            verb="Break-Even Point"
            revealed={revealed}
            onCalculate={reveal}
            results={results}
        >
            <SectionCard label="Your costs">
                <FieldGrid>
                    <CurrencyField
                        label="Fixed Costs per Month"
                        value={fixedCosts}
                        onChange={setFixedCosts}
                        hint="Rent, salaries, insurance — costs that stay the same regardless of sales volume."
                    />
                    <CurrencyField
                        label="Variable Cost per Unit"
                        value={variableCost}
                        onChange={setVariableCost}
                        hint="Materials, packaging, shipping — costs that scale with each unit sold."
                    />
                </FieldGrid>
            </SectionCard>
            <SectionCard label="Pricing">
                <FieldGrid>
                    <CurrencyField label="Selling Price per Unit" value={price} onChange={setPrice} />
                    <SelectField
                        label="Business Type"
                        value={businessType}
                        onChange={setBusinessType}
                        options={[
                            { value: "single", label: "Single Product" },
                            { value: "multi", label: "Multiple Products" },
                        ]}
                    />
                </FieldGrid>
            </SectionCard>
            <SectionCard label="Targets">
                <FieldGrid>
                    <PercentField
                        label="Target Net Profit Margin"
                        value={targetMargin}
                        onChange={setTargetMargin}
                        hint="The profit margin you want after covering all costs, as a percent of revenue."
                    />
                    <PercentField
                        label="Seasonality Adjustment"
                        value={seasonality}
                        onChange={setSeasonality}
                        hint="Extra cushion for slow seasons — 10% adds a 10% buffer to your break-even target."
                    />
                </FieldGrid>
            </SectionCard>
        </CalculatorScreen>
    )
}

// MARK: - Cash flow

function CashFlowScreen() {
    const entry = calculatorBySlug("cash-flow")!
    const { revealed, reveal } = useReveal()
    const [startingBalance, setStartingBalance] = useState("")
    const [monthlyRevenue, setMonthlyRevenue] = useState("")
    const [monthlyExpenses, setMonthlyExpenses] = useState("")
    const [growthRate, setGrowthRate] = useState("")
    const [period, setPeriod] = useState("12")

    const results = Calc.cashFlow({
        startingBalance: calcValue(startingBalance),
        monthlyRevenue: calcValue(monthlyRevenue),
        monthlyExpenses: calcValue(monthlyExpenses),
        growthRate: calcValue(growthRate),
        period: calcValue(period),
    })

    return (
        <CalculatorScreen entry={entry} verb="Cash Flow" revealed={revealed} onCalculate={reveal} results={results}>
            <SectionCard label="Starting point">
                <FieldGrid>
                    <CurrencyField
                        label="Starting Cash Balance"
                        value={startingBalance}
                        onChange={setStartingBalance}
                    />
                </FieldGrid>
            </SectionCard>
            <SectionCard label="Monthly activity">
                <FieldGrid>
                    <CurrencyField label="Monthly Revenue" value={monthlyRevenue} onChange={setMonthlyRevenue} />
                    <CurrencyField label="Monthly Expenses" value={monthlyExpenses} onChange={setMonthlyExpenses} />
                </FieldGrid>
            </SectionCard>
            <SectionCard label="Projection">
                <FieldGrid>
                    <PercentField
                        label="Monthly Growth Rate"
                        value={growthRate}
                        onChange={setGrowthRate}
                        hint="Expected month-over-month change in revenue. Use a negative number to model a decline."
                    />
                    <StepperField
                        label="Projection Period"
                        value={period}
                        onChange={setPeriod}
                        min={1}
                        unit="mo"
                    />
                </FieldGrid>
            </SectionCard>
        </CalculatorScreen>
    )
}

// MARK: - Startup cost

function StartupCostScreen() {
    const entry = calculatorBySlug("startup-cost")!
    const { revealed, reveal } = useReveal()
    // The industry template is decorative — it doesn't feed the formula, which
    // matches the spec (there is no per-template branch).
    const [template, setTemplate] = useState<"retail" | "restaurant" | "saas" | "service">("retail")
    const [setupCosts, setSetupCosts] = useState("")
    const [operatingCosts, setOperatingCosts] = useState("")
    const [runwayMonths, setRunwayMonths] = useState("6")
    const [funding, setFunding] = useState("")

    const results = Calc.startupCost({
        setupCosts: calcValue(setupCosts),
        operatingCosts: calcValue(operatingCosts),
        runwayMonths: calcValue(runwayMonths),
        funding: calcValue(funding),
    })

    return (
        <CalculatorScreen
            entry={entry}
            verb="Startup Cost"
            revealed={revealed}
            onCalculate={reveal}
            results={results}
        >
            <SectionCard label="Setup">
                <FieldGrid>
                    <SelectField
                        label="Industry Template"
                        value={template}
                        onChange={setTemplate}
                        options={[
                            { value: "retail", label: "Retail" },
                            { value: "restaurant", label: "Restaurant" },
                            { value: "saas", label: "SaaS" },
                            { value: "service", label: "Service Business" },
                        ]}
                    />
                    <CurrencyField label="One-Time Setup Costs" value={setupCosts} onChange={setSetupCosts} />
                </FieldGrid>
            </SectionCard>
            <SectionCard label="Operating">
                <FieldGrid>
                    <CurrencyField
                        label="Monthly Operating Costs"
                        value={operatingCosts}
                        onChange={setOperatingCosts}
                    />
                    <StepperField
                        label="Months of Runway Needed"
                        value={runwayMonths}
                        onChange={setRunwayMonths}
                        min={1}
                        unit="mo"
                        hint="How many months of operating costs to hold in reserve after launch."
                    />
                </FieldGrid>
            </SectionCard>
            <SectionCard label="Funding">
                <FieldGrid>
                    <CurrencyField label="Available Funding" value={funding} onChange={setFunding} />
                </FieldGrid>
            </SectionCard>
        </CalculatorScreen>
    )
}

// MARK: - Pricing

function PricingScreen() {
    const entry = calculatorBySlug("pricing")!
    const { revealed, reveal } = useReveal()
    const [cost, setCost] = useState("")
    const [competitorPrice, setCompetitorPrice] = useState("")
    const [positioning, setPositioning] = useState<"value" | "match" | "premium">("match")
    const [targetMargin, setTargetMargin] = useState("")

    const results = Calc.pricing({
        cost: calcValue(cost),
        competitorPrice: calcValue(competitorPrice),
        positioning,
        targetMargin: calcValue(targetMargin),
    })

    return (
        <CalculatorScreen entry={entry} verb="Price" revealed={revealed} onCalculate={reveal} results={results}>
            <SectionCard label="Your costs">
                <FieldGrid>
                    <CurrencyField label="Cost per Unit" value={cost} onChange={setCost} />
                </FieldGrid>
            </SectionCard>
            <SectionCard label="Market">
                <div className="flex flex-col gap-4">
                    <FieldGrid>
                        <CurrencyField
                            label="Competitor Price"
                            value={competitorPrice}
                            onChange={setCompetitorPrice}
                        />
                    </FieldGrid>
                    <SegmentedField
                        label="Desired Positioning"
                        value={positioning}
                        onChange={setPositioning}
                        options={[
                            { value: "value", label: "Value" },
                            { value: "match", label: "Match" },
                            { value: "premium", label: "Premium" },
                        ]}
                    />
                </div>
            </SectionCard>
            <SectionCard label="Target">
                <FieldGrid>
                    <PercentField label="Target Profit Margin" value={targetMargin} onChange={setTargetMargin} />
                </FieldGrid>
            </SectionCard>
        </CalculatorScreen>
    )
}

// MARK: - Employee vs contractor

function EmployeeContractorScreen() {
    const entry = calculatorBySlug("employee-contractor")!
    const { revealed, reveal } = useReveal()
    const [salary, setSalary] = useState("")
    const [benefits, setBenefits] = useState("")
    const [hourlyRate, setHourlyRate] = useState("")
    const [hoursPerYear, setHoursPerYear] = useState("2000")

    const results = Calc.employeeContractor({
        salary: calcValue(salary),
        benefits: calcValue(benefits),
        hourlyRate: calcValue(hourlyRate),
        hoursPerYear: calcValue(hoursPerYear),
    })

    return (
        <CalculatorScreen
            entry={entry}
            verb="Comparison"
            revealed={revealed}
            onCalculate={reveal}
            results={results}
        >
            <SectionCard label="Employee cost">
                <FieldGrid>
                    <CurrencyField label="Annual Salary" value={salary} onChange={setSalary} />
                    <PercentField
                        label="Benefits & Overhead"
                        value={benefits}
                        onChange={setBenefits}
                        hint="Payroll tax, healthcare, and other costs on top of salary — typically 20–35%."
                    />
                </FieldGrid>
            </SectionCard>
            <SectionCard label="Contractor cost">
                <FieldGrid>
                    <CurrencyField label="Contractor Hourly Rate" value={hourlyRate} onChange={setHourlyRate} />
                    <StepperField
                        label="Hours per Year"
                        value={hoursPerYear}
                        onChange={setHoursPerYear}
                        min={100}
                        unit="hrs"
                    />
                </FieldGrid>
            </SectionCard>
        </CalculatorScreen>
    )
}

// MARK: - Loan

function LoanScreen() {
    const entry = calculatorBySlug("loan")!
    const { revealed, reveal } = useReveal()
    const [mode, setMode] = useState<Calc.LoanMode>("payment")
    const [loanType, setLoanType] = useState<"personal" | "auto" | "mortgage" | "student">("personal")
    const [amount, setAmount] = useState("")
    const [rate, setRate] = useState("")
    const [term, setTerm] = useState("60")
    const [paymentsMade, setPaymentsMade] = useState("12")
    const [monthlyPayment, setMonthlyPayment] = useState("")

    const results = Calc.loan({
        amount: calcValue(amount),
        rate: calcValue(rate),
        term: calcValue(term),
        paymentsMade: calcValue(paymentsMade),
        payment: calcValue(monthlyPayment),
        mode,
    })

    const verb = mode === "payment" ? "Payment" : mode === "apr" ? "APR" : mode === "initial" ? "Initial" : "Remaining"

    /** Names the field that is actually missing, and the case with no answer. */
    const invalidMessage = (() => {
        switch (mode) {
            case "payment":
                return "Enter a loan amount and a term to see the payment."
            case "apr":
                if (
                    calcValue(amount) > 0 &&
                    calcValue(monthlyPayment) > 0 &&
                    calcValue(monthlyPayment) * calcValue(term) < calcValue(amount)
                ) {
                    return `Those payments never repay the loan: ${term} payments of ${currency(
                        calcValue(monthlyPayment)
                    )} comes to less than the amount borrowed, so there is no rate that fits.`
                }
                return "Enter the loan amount, the monthly payment and the term to solve the APR."
            case "initial":
                return "Enter the monthly payment, the rate and the term to see what was borrowed."
            default:
                return "Enter a loan amount and a term to see what is still owed."
        }
    })()

    return (
        <CalculatorScreen
            entry={entry}
            verb={verb}
            revealed={revealed}
            onCalculate={reveal}
            results={results}
            invalidMessage={invalidMessage}
        >
            <div className="rounded-lg border border-border bg-card px-4 py-4 shadow-sm sm:px-[18px]">
                <SegmentedControl
                    value={mode}
                    onChange={setMode}
                    ariaLabel="What to solve for"
                    options={[
                        { value: "payment", label: "Payment" },
                        { value: "apr", label: "APR" },
                        { value: "remaining", label: "Remaining" },
                        { value: "initial", label: "Initial" },
                    ]}
                />
            </div>
            <SectionCard label="Loan details">
                <FieldGrid>
                    <SelectField
                        label="Loan Type"
                        value={loanType}
                        onChange={setLoanType}
                        options={[
                            { value: "personal", label: "Personal Loan" },
                            { value: "auto", label: "Auto Loan" },
                            { value: "mortgage", label: "Mortgage" },
                            { value: "student", label: "Student Loan" },
                        ]}
                    />
                    {mode !== "initial" && (
                        <CurrencyField label="Loan Amount" value={amount} onChange={setAmount} />
                    )}
                </FieldGrid>
            </SectionCard>
            <SectionCard label="Repayment">
                <FieldGrid>
                    {mode !== "apr" && <PercentField label="Interest Rate" value={rate} onChange={setRate} />}
                    <StepperField label="Term" value={term} onChange={setTerm} min={6} unit="mo" />
                    {mode === "remaining" && (
                        <StepperField
                            label="Payments Made"
                            value={paymentsMade}
                            onChange={setPaymentsMade}
                            min={0}
                            unit="mo"
                        />
                    )}
                    {(mode === "initial" || mode === "apr") && (
                        <CurrencyField
                            label="Monthly Payment"
                            value={monthlyPayment}
                            onChange={setMonthlyPayment}
                            hint={
                                mode === "apr"
                                    ? "What you pay each month. With the amount borrowed and the term, this is enough to solve the rate you are actually paying."
                                    : "What you pay each month. With the rate and the term, this is enough to work back to what was originally borrowed."
                            }
                        />
                    )}
                </FieldGrid>
            </SectionCard>
        </CalculatorScreen>
    )
}

// MARK: - Registry

const SCREENS: Record<CalculatorSlug, () => React.ReactElement> = {
    "emergency-fund": EmergencyFundScreen,
    "break-even": BreakEvenScreen,
    "startup-cost": StartupCostScreen,
    "cash-flow": CashFlowScreen,
    loan: LoanScreen,
    pricing: PricingScreen,
    roi: ROIScreen,
    "employee-contractor": EmployeeContractorScreen,
    "profit-margin": ProfitMarginScreen,
    retirement: RetirementScreen,
    "compound-interest": CompoundInterestScreen,
}

export function CalculatorBySlug({ slug }: { slug: CalculatorSlug }) {
    const Screen = SCREENS[slug]
    return <Screen />
}
