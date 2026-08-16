/**
 * The declarative question bank. Each question reads/writes one answer keyed by
 * its id; `dependsOn` runs over the live answers so the visible set is adaptive.
 * `buildReturn` (sibling file) maps these answer ids into a TaxReturn2024.
 */
import type { Answers, Question } from "../types/question"
import { SUPPORTED_STATES } from "../engine/stateTaxData"

const STATE_OPTIONS = SUPPORTED_STATES.map((s) => ({ value: s.code, label: s.name }))

const isMFS = (a: Answers) => a.q_filing === "mfs"
const isMarried = (a: Answers) => a.q_filing === "mfj" || a.q_filing === "qss"
const numAns = (a: Answers, id: string) => (typeof a[id] === "number" ? (a[id] as number) : 0)

export const QUESTION_BANK: Question[] = [
  // ---- About you ----
  {
    id: "q_filing",
    sectionId: "about-you",
    text: "What's your filing status?",
    inputType: "select",
    options: [
      { value: "single", label: "Single" },
      { value: "mfj", label: "Married filing jointly" },
      { value: "mfs", label: "Married filing separately" },
      { value: "hoh", label: "Head of household" },
      { value: "qss", label: "Qualifying surviving spouse" },
    ],
    helpText: "Your status sets your tax brackets and standard deduction.",
  },
  {
    id: "q_lived_apart",
    sectionId: "about-you",
    text: "Did you live apart from your spouse for the entire tax year?",
    inputType: "boolean",
    dependsOn: isMFS,
    helpText: "Affects how your Social Security benefits and some credits are treated.",
  },
  { id: "q_age", sectionId: "about-you", text: "How old were you at the end of the tax year?", inputType: "integer", placeholder: "e.g. 40" },
  { id: "q_blind", sectionId: "about-you", text: "Are you legally blind?", inputType: "boolean", helpText: "Adds to your standard deduction." },
  { id: "q_spouse_age", sectionId: "about-you", text: "How old was your spouse at the end of the tax year?", inputType: "integer", dependsOn: isMarried },
  { id: "q_spouse_blind", sectionId: "about-you", text: "Is your spouse legally blind?", inputType: "boolean", dependsOn: isMarried },
  {
    id: "q_claimed_dependent",
    sectionId: "about-you",
    text: "Can someone else claim you as a dependent?",
    inputType: "boolean",
    helpText: "If yes, your standard deduction may be limited.",
  },
  {
    id: "q_state",
    sectionId: "about-you",
    text: "Which state did you live in?",
    inputType: "select",
    options: STATE_OPTIONS,
    helpText: "Adds a state income tax estimate (top 15 states). Leave blank to skip.",
  },

  // ---- Dependents ----
  {
    id: "q_qual_children",
    sectionId: "dependents",
    text: "How many qualifying children under 17 did you support?",
    inputType: "integer",
    placeholder: "0",
    helpText: "Each can qualify for the $2,000 Child Tax Credit.",
  },
  {
    id: "q_other_deps",
    sectionId: "dependents",
    text: "How many other dependents did you support?",
    inputType: "integer",
    placeholder: "0",
    helpText: "Each can qualify for the $500 Credit for Other Dependents.",
  },

  // ---- Job income ----
  { id: "q_wages", sectionId: "income-job", text: "Total wages (W-2 box 1)", inputType: "dollar" },
  { id: "q_withholding", sectionId: "income-job", text: "Federal income tax withheld (W-2 box 2)", inputType: "dollar" },

  // ---- Self-employment ----
  { id: "q_se_profit", sectionId: "income-self", text: "Net self-employment profit (after expenses)", inputType: "dollar", allowNegative: true },
  {
    id: "q_se_sstb",
    sectionId: "income-self",
    text: "Is this a professional-service business (law, health, consulting, finance, etc.)?",
    inputType: "boolean",
    helpText: "Specified service businesses lose the QBI deduction at higher incomes.",
  },
  { id: "q_se_health", sectionId: "income-self", text: "Self-employed health insurance premiums", inputType: "dollar" },

  // ---- Investments ----
  { id: "q_interest", sectionId: "income-investments", text: "Taxable interest (1099-INT box 1)", inputType: "dollar" },
  { id: "q_tax_exempt", sectionId: "income-investments", text: "Tax-exempt interest (1099-INT box 8)", inputType: "dollar" },
  { id: "q_ord_div", sectionId: "income-investments", text: "Ordinary dividends (1099-DIV box 1a)", inputType: "dollar" },
  { id: "q_qual_div", sectionId: "income-investments", text: "Qualified dividends (1099-DIV box 1b)", inputType: "dollar", helpText: "Taxed at lower capital-gains rates." },
  { id: "q_ltcg", sectionId: "income-investments", text: "Long-term capital gain or loss", inputType: "dollar", allowNegative: true },
  { id: "q_stcg", sectionId: "income-investments", text: "Short-term capital gain or loss", inputType: "dollar", allowNegative: true },
  { id: "q_capgain_dist", sectionId: "income-investments", text: "Capital gain distributions (1099-DIV box 2a)", inputType: "dollar" },

  // ---- Retirement & Social Security ----
  { id: "q_ss_benefits", sectionId: "income-retirement", text: "Social Security benefits (1099-SSA box 5)", inputType: "dollar" },
  { id: "q_retire_taxable", sectionId: "income-retirement", text: "Taxable pension/IRA distributions (1099-R box 2a)", inputType: "dollar" },
  {
    id: "q_retire_early",
    sectionId: "income-retirement",
    text: "Was any of that an early withdrawal (under 59½, no exception)?",
    inputType: "boolean",
    dependsOn: (a) => numAns(a, "q_retire_taxable") > 0,
    helpText: "Early withdrawals usually add a 10% penalty.",
  },

  // ---- Other income ----
  { id: "q_unemployment", sectionId: "income-other", text: "Unemployment compensation (1099-G)", inputType: "dollar" },
  { id: "q_other_income", sectionId: "income-other", text: "Other taxable income", inputType: "dollar" },

  // ---- Adjustments ----
  { id: "q_student_loan", sectionId: "adjustments", text: "Student loan interest paid", inputType: "dollar" },
  { id: "q_educator", sectionId: "adjustments", text: "Educator (K-12) classroom expenses", inputType: "dollar" },
  {
    id: "q_hsa_coverage",
    sectionId: "adjustments",
    text: "Did you have a high-deductible health plan (HSA)?",
    inputType: "select",
    options: [
      { value: "none", label: "No HSA" },
      { value: "self-only", label: "Self-only coverage" },
      { value: "family", label: "Family coverage" },
    ],
  },
  { id: "q_hsa_contribution", sectionId: "adjustments", text: "HSA contribution", inputType: "dollar", dependsOn: (a) => a.q_hsa_coverage === "self-only" || a.q_hsa_coverage === "family" },
  { id: "q_ira_contribution", sectionId: "adjustments", text: "Traditional IRA contribution", inputType: "dollar" },
  { id: "q_ira_covered", sectionId: "adjustments", text: "Are you covered by a workplace retirement plan?", inputType: "boolean", dependsOn: (a) => numAns(a, "q_ira_contribution") > 0 },

  // ---- Deductions ----
  {
    id: "q_itemize",
    sectionId: "deductions",
    text: "Do you want to enter itemized deductions?",
    inputType: "boolean",
    helpText: "We'll automatically use whichever is larger — standard or itemized.",
  },
  { id: "q_mortgage_interest", sectionId: "deductions", text: "Home mortgage interest", inputType: "dollar", dependsOn: (a) => a.q_itemize === true },
  { id: "q_mortgage_balance", sectionId: "deductions", text: "Mortgage balance", inputType: "dollar", dependsOn: (a) => a.q_itemize === true },
  { id: "q_salt", sectionId: "deductions", text: "State & local income (or sales) tax", inputType: "dollar", dependsOn: (a) => a.q_itemize === true },
  { id: "q_property_tax", sectionId: "deductions", text: "Property taxes", inputType: "dollar", dependsOn: (a) => a.q_itemize === true },
  { id: "q_charitable", sectionId: "deductions", text: "Charitable contributions (cash)", inputType: "dollar", dependsOn: (a) => a.q_itemize === true },
  { id: "q_medical", sectionId: "deductions", text: "Medical & dental expenses", inputType: "dollar", dependsOn: (a) => a.q_itemize === true },

  // ---- Credits ----
  { id: "q_care_expenses", sectionId: "credits", text: "Child/dependent care expenses paid", inputType: "dollar", dependsOn: (a) => a.ls_care === true },
  { id: "q_care_children", sectionId: "credits", text: "How many children under 13 were in care?", inputType: "integer", placeholder: "0", dependsOn: (a) => a.ls_care === true },
  { id: "q_edu_expenses", sectionId: "credits", text: "Qualified tuition & fees paid", inputType: "dollar", dependsOn: (a) => a.ls_education === true },
  { id: "q_edu_aotc", sectionId: "credits", text: "Is the student in their first 4 years of an undergraduate degree?", inputType: "boolean", dependsOn: (a) => a.ls_education === true, helpText: "If yes, the more generous American Opportunity Credit applies." },
  { id: "q_savers_contrib", sectionId: "credits", text: "Retirement contributions (for the Saver's Credit)", inputType: "dollar", dependsOn: (a) => a.ls_savings === true },
  { id: "q_clean_energy", sectionId: "credits", text: "Home clean-energy property cost (solar, etc.)", inputType: "dollar", dependsOn: (a) => a.ls_energy === true },
  { id: "q_ev_credit", sectionId: "credits", text: "Clean vehicle (EV) credit amount", inputType: "dollar", dependsOn: (a) => a.ls_energy === true },

  // ---- Payments ----
  { id: "q_est_payments", sectionId: "payments", text: "Estimated tax payments made", inputType: "dollar" },
  { id: "q_extra_withholding", sectionId: "payments", text: "Other federal tax withheld (not on your W-2)", inputType: "dollar" },
  { id: "q_state_withholding", sectionId: "payments", text: "State income tax withheld (W-2 box 17)", inputType: "dollar", dependsOn: (a) => typeof a.q_state === "string" && a.q_state !== "" },
  { id: "q_prior_tax", sectionId: "payments", text: "Your 2023 total tax (for the underpayment check)", inputType: "dollar" },
  { id: "q_prior_agi", sectionId: "payments", text: "Your 2023 AGI", inputType: "dollar" },
]
