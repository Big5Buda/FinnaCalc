import { calculateFederalTax } from "@/components/tax-engine/engine"
import { SUPPORTED_TAX_YEAR } from "@/components/tax-engine/engine/constants/taxRules"
import { makeEmptyReturn } from "@/components/tax-engine/types/taxReturn"
import type { FilingStatus } from "@/components/tax-engine/types/filing"

export const TAX_MONEY_FIELDS = ["wages", "withheld", "interest", "selfEmployment", "charity", "tips", "overtime", "carInterest"] as const
export type TaxMoneyField = typeof TAX_MONEY_FIELDS[number]
export type QuickTaxForm = Record<TaxMoneyField, string> & { filingStatus: FilingStatus | ""; dependents: string; age: string; activeBusiness: boolean }
export function emptyQuickTaxForm(): QuickTaxForm {
    return { filingStatus: "", wages: "", withheld: "", interest: "", selfEmployment: "", dependents: "", age: "", charity: "", tips: "", overtime: "", carInterest: "", activeBusiness: false }
}
const LABELS: Record<TaxMoneyField, string> = { wages: "Wages", withheld: "Federal withholding", interest: "Interest income", selfEmployment: "Self-employment income", charity: "Charitable gifts", tips: "Qualified tips", overtime: "Qualified overtime", carInterest: "Vehicle-loan interest" }
export function parseTaxMoney(raw: string, label: string): number {
    if (raw.trim() === "") return 0
    const entered = raw.trim().replace(/^\$\s*/, "")
    const value = entered.replace(/,/g, "")
    const number = Number(value)
    if (!/^(?:(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{0,2})?|\.\d{1,2})$/.test(entered) || !Number.isFinite(number) || number < 0 || number > 1e9) throw new Error(`${label}: enter an amount from $0 to $1 billion, with at most two decimal places.`)
    return number
}
function integer(raw: string, label: string, min: number, max: number) {
    if (!/^\d+$/.test(raw.trim()) || !Number.isInteger(Number(raw)) || Number(raw) < min || Number(raw) > max) throw new Error(`${label}: enter a whole number from ${min} to ${max}.`)
    return Number(raw)
}
/** The existing quick-estimate mapping; only invoked after an explicit Calculate. */
export function calculateQuickTax(form: QuickTaxForm) {
    if (!["single", "mfj", "mfs", "hoh", "qss"].includes(form.filingStatus)) throw new Error("Choose your filing status.")
    const filingStatus = form.filingStatus as FilingStatus
    const values = Object.fromEntries(TAX_MONEY_FIELDS.map(field => [field, parseTaxMoney(form[field], LABELS[field])])) as Record<TaxMoneyField, number>
    const { wages, withheld, interest, selfEmployment, charity, tips, overtime, carInterest } = values
    const dependents = form.dependents.trim() === "" ? 0 : integer(form.dependents, "Dependent children", 0, 99)
    const age = form.age.trim() === "" ? "" : String(integer(form.age, "Age", 1, 120))
    const activeBusiness = form.activeBusiness
        const draft = makeEmptyReturn()
        draft.filingStatus = filingStatus
        draft.taxpayer.dateOfBirth = age && Number(age)>0 ? `${SUPPORTED_TAX_YEAR-Number(age)}-06-15` : ""
        draft.itemized.charitableCash = charity
        draft.activeQbiConfirmed = activeBusiness
        draft.newDeductions = { qualifiedTips: tips, qualifiedOvertime: overtime, carLoanInterest: carInterest }

        // One W-2 carrying the wage boxes the engine needs: Social Security and
        // Medicare wages track box 1 for an ordinary employee, and the payroll
        // taxes withheld follow the statutory rates.
        if (wages > 0 || withheld > 0) {
            draft.income.flags.hasW2 = true
            draft.income.w2 = [
                {
                    id: "w2-1",
                    employerName: "Employer",
                    owner: "taxpayer",
                    box1Wages: wages,
                    box2FederalWithholding: withheld,
                    box3SsWages: wages,
                    box4SsWithheld: Math.round(wages * 0.062 * 100) / 100,
                    box5MedicareWages: wages,
                    box6MedicareWithheld: Math.round(wages * 0.0145 * 100) / 100,
                    box12: [],
                    statutoryEmployee: false,
                    box17StateWithholding: 0,
                },
            ]
        }

        if (interest > 0) {
            draft.income.flags.hasInterest = true
            draft.income.f1099Int = [
                { id: "int-1", payer: "Bank", box1Interest: interest, box3UsTreasuryInterest: 0, box8TaxExemptInterest: 0, box4FederalWithholding: 0 },
            ]
        }

        if (selfEmployment > 0) {
            draft.income.flags.hasSelfEmployment = true
            draft.income.scheduleC = [
                {
                    id: "sch-c-1",
                    owner: "taxpayer",
                    businessName: "Self-employment", description: "Business",
                    grossReceipts: selfEmployment, costOfGoodsSold:0,
                    expenses: {}, homeOfficeDeduction:0, vehicleExpense:0, isSSTB:false,
                },
            ]
        }

        // Dependents young enough for the child tax credit — the common case,
        // and the one that moves the number most.
        draft.dependents = Array.from({ length: dependents }, (_, index) => ({
            id: `dep-${index}`, firstName:"Child",lastName:"",ssn:"",dateOfBirth:"2018-01-01",
            relationshipType:"child",relationship:"child",monthsLivedWithTaxpayer:12,
            taxpayerProvidedOverHalfSupport:true,qualifiesForCTC:true,qualifiesForODC:false,
            qualifiesForEITC:true,qualifiesForCareCredit:false,
        }))

    return calculateFederalTax(draft)
}
