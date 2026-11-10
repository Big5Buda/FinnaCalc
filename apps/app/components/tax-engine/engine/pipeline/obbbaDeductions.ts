import type { TaxReturn2024 } from "../../types/taxReturn"
import { isConsidered65For2024 } from "./deductionCompare"
import { SENIOR_DEDUCTION_2026 as SENIOR, TIPS_DEDUCTION_2026 as TIPS, OVERTIME_DEDUCTION_2026 as OT, CAR_LOAN_INTEREST_2026 as CAR } from "../constants/changes2026"
/** Qualified, already-taxed income only. These are deductions, not payroll-tax exemptions. */
export function computeNewDeductions(r: TaxReturn2024, magi: number) {
    if (r.meta.taxYear !== 2026) return { senior:0,tips:0,overtime:0,car:0,total:0 }
    const joint=r.filingStatus === "mfj", separate=r.filingStatus === "mfs"
    const people=Number(isConsidered65For2024(r.taxpayer.dateOfBirth,2026)) + Number(joint && !!r.spouse && isConsidered65For2024(r.spouse.dateOfBirth,2026))
    const senior=separate ? 0 : people*Math.max(0,SENIOR.perPerson-SENIOR.phaseoutRate*Math.max(0,magi-SENIOR.threshold[r.filingStatus]))
    const inputs=r.newDeductions
    const tips=separate ? 0 : Math.max(0,Math.min(Math.max(0,inputs?.qualifiedTips ?? 0),TIPS.cap)-100*Math.floor(Math.max(0,magi-(joint?TIPS.thresholdMfj:TIPS.threshold))/1000))
    const overtime=separate ? 0 : Math.max(0,Math.min(Math.max(0,inputs?.qualifiedOvertime ?? 0),joint?OT.capMfj:OT.cap)-100*Math.floor(Math.max(0,magi-(joint?OT.thresholdMfj:OT.threshold))/1000))
    const car=Math.max(0,Math.min(Math.max(0,inputs?.carLoanInterest ?? 0),CAR.cap)-200*Math.ceil(Math.max(0,magi-(joint?CAR.thresholdMfj:CAR.threshold))/1000))
    return {senior,tips,overtime,car,total:senior+tips+overtime+car}
}
