import { describe, it, expect } from "vitest"
import { makeEmptyReturn } from "../../types/taxReturn"
import { calculateFederalTax } from "../calculator"
import { taxRules, effectiveSaltCap } from "../constants/taxRules"
import { computeRegularTax } from "../pipeline/regularTax"
import { computeSelfEmploymentTax } from "../pipeline/scheduleSE"
import { computeStandardDeduction, computeDeduction, computeItemizedDeduction, isConsidered65For2024 } from "../pipeline/deductionCompare"
import { computeAmt } from "../pipeline/amt"
import { computeCareCredit } from "../pipeline/careCredit"
import { computeCleanEnergyCredit, computeEvCredit } from "../pipeline/otherCredits"
import { computeEitc } from "../pipeline/eitc"
import { computeQbiDeduction } from "../pipeline/qbi"
import { computeNewDeductions } from "../pipeline/obbbaDeductions"
import { build1040Summary } from "../../export/build1040Summary"
import { buildReturn } from "../../questions/buildReturn"

function wages(amount: number) {
    const r=makeEmptyReturn();r.income.flags.hasW2=true
    r.income.w2.push({id:"w",owner:"taxpayer",employerName:"",box1Wages:amount,box2FederalWithholding:9000,box3SsWages:amount,box4SsWithheld:0,box5MedicareWages:amount,box6MedicareWithheld:0,box12:[],statutoryEmployee:false,box17StateWithholding:0})
    return r
}
describe("2026 federal rules - IRS Rev Proc 2025-32 and 2026 guidance",()=>{
 it("defaults fresh returns to 2026 without reinterpreting explicit historical returns",()=>{expect(makeEmptyReturn().meta.taxYear).toBe(2026);expect(makeEmptyReturn(2024).meta.taxYear).toBe(2024);expect(taxRules(2024).STANDARD_DEDUCTION_2024.single).toBe(14600)})
 it("uses the published standard deductions for all filing statuses",()=>{expect(taxRules(2026).STANDARD_DEDUCTION_2024).toEqual({single:16100,mfj:32200,mfs:16100,hoh:24150,qss:32200})})
 it("uses the 2026 Single Tax Table midpoint for wages of $75,000",()=>{const out=calculateFederalTax(wages(75000));expect(out.taxableIncome).toBe(58900);expect(out.regularTax).toBe(7676);expect(out.refundOrOwed).toBe(1324);expect(out.taxYear).toBe(2026);expect(build1040Summary(out).taxYear).toBe(2026)})
 it("uses the joint rate schedule above the tax-table range",()=>{expect(computeRegularTax(117800,"mfj",2026).tax).toBe(15340)})
 it("separates 2024 and 2026 bracket computations",()=>{expect(computeRegularTax(58900,"single",2024).tax).not.toBe(computeRegularTax(58900,"single",2026).tax)})
 it("applies the 2026 child credit to actual qualifying dependent flags",()=>{const r=buildReturn({q_wages:75000,q_qual_children:2});expect(calculateFederalTax(r).nonrefundableCredits.childTaxCredit).toBe(4400)})
 it("uses the $184,500 SE Social Security wage base",()=>{const out=computeSelfEmploymentTax({taxpayer:300000,spouse:0},{taxpayer:0,spouse:0},2026);expect(out.seTax).toBeCloseTo(30912.45,2)})
 it("uses the year-specific senior age boundary",()=>{expect(isConsidered65For2024("1962-01-01",2026)).toBe(true);expect(isConsidered65For2024("1962-01-02",2026)).toBe(false);expect(isConsidered65For2024("1962-01-01",2024)).toBe(false)})
 it("adds the indexed age-65 standard deduction separately from Schedule 1-A",()=>{const r=makeEmptyReturn();r.taxpayer.dateOfBirth="1960-06-15";expect(computeStandardDeduction(r,0)).toBe(18150);expect(computeNewDeductions(r,50000).senior).toBe(6000)})
 it("phases the senior deduction per person and excludes MFS",()=>{const r=makeEmptyReturn();r.taxpayer.dateOfBirth="1960-06-15";expect(computeNewDeductions(r,100000).senior).toBe(4500);r.filingStatus="mfs";expect(computeNewDeductions(r,50000).senior).toBe(0)})
 it("allows standard-deduction cash gifts up to the new limit",()=>{const r=makeEmptyReturn();r.itemized.charitableCash=2000;expect(computeDeduction(r,50000,50000).amount).toBe(17100)})
 it("applies the itemized charity floor without changing AGI",()=>{const r=makeEmptyReturn();r.itemized.charitableCash=2000;expect(computeItemizedDeduction(r,50000)).toBe(1750)})
 it("phases the indexed SALT cap to its statutory floor",()=>{expect(effectiveSaltCap("single",505000,2026)).toBe(40400);expect(effectiveSaltCap("single",595000,2026)).toBe(13400);expect(effectiveSaltCap("single",900000,2026)).toBe(10000);expect(effectiveSaltCap("mfs",252500,2026)).toBe(20200)})
 it("phases the AMT exemption at 50% rather than 25%",()=>{expect(computeAmt({taxableIncome:510000,addBacks:0,preferentialIncome:0,regularTax:0,status:"single",taxYear:2026}).exemption).toBe(85100)})
 it("uses the wider QBI SSTB phase-in range",()=>{expect(computeQbiDeduction({qbiIncome:100000,taxableIncomeBeforeQbi:239250,netCapitalGain:0,isSSTB:true,status:"single",taxYear:2026}).deduction).toBe(10000)})
 it("requires confirmed active QBI before applying its new minimum",()=>{const p={qbiIncome:1000,taxableIncomeBeforeQbi:10000,netCapitalGain:0,isSSTB:false,status:"single" as const,taxYear:2026 as const};expect(computeQbiDeduction(p).deduction).toBe(200);expect(computeQbiDeduction({...p,activeQbiConfirmed:true}).deduction).toBe(400)})
 it("does not credit new 2026 clean-energy property cost",()=>{const r=makeEmptyReturn();r.credits.cleanEnergyCost=10000;expect(computeCleanEnergyCredit(r)).toBe(0);r.credits.cleanEnergyCarryforward=1250;expect(computeCleanEnergyCredit(r)).toBe(1250)})
 it("requires the earlier EV acquisition confirmation",()=>{const r=makeEmptyReturn();r.credits.evCreditAmount=7500;expect(computeEvCredit(r,50000)).toBe(0);r.credits.evAcquiredByDeadline=true;expect(computeEvCredit(r,50000)).toBe(7500)})
 it("applies both stages of the 2026 dependent-care rate",()=>{const r=buildReturn({q_care_children:1,q_care_expenses:3000,q_wages:10000});expect(computeCareCredit(r,15000)).toBe(1500);expect(computeCareCredit(r,50000)).toBe(1050);expect(computeCareCredit(r,77000)).toBe(1020)})
 it("caps EITC at the published 2026 income endpoint",()=>{const r=makeEmptyReturn();expect(computeEitc({r,earnedIncome:19540,agi:19540,investmentIncome:0,taxpayerAge:30}).credit).toBe(0)})
 it("does not assume the childless EITC age test was met",()=>{const r=makeEmptyReturn();expect(computeEitc({r,earnedIncome:10000,agi:10000,investmentIncome:0}).credit).toBe(0);expect(computeEitc({r,earnedIncome:10000,agi:10000,investmentIncome:0,taxpayerAge:30}).credit).toBe(664)})
 it("uses floor steps for tips/overtime and ceiling steps for car interest",()=>{const r=makeEmptyReturn();r.newDeductions={qualifiedTips:1000,qualifiedOvertime:1000,carLoanInterest:1000};expect(computeNewDeductions(r,150001).tips).toBe(1000);expect(computeNewDeductions(r,151000).tips).toBe(900);expect(computeNewDeductions(r,100001).car).toBe(800)})
 it("does not mislabel legacy state tables as 2026",()=>{const r=wages(75000);r.residency.state="CA";expect(calculateFederalTax(r).state?.supported).toBe(false)})
})
