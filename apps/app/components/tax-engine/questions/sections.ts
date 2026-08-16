/**
 * Interview sections. Each section appears only when its `dependsOn` gate (driven
 * by the Life Situations screen and prior answers) is satisfied. The "life" and
 * "review" screens are handled specially by the interview shell.
 */
import type { Answers, Section } from "../types/question"

const truthy = (v: unknown) => v === true

export const SECTIONS: Section[] = [
  { id: "about-you", title: "About you", icon: "User", description: "Filing status and a few basics." },
  {
    id: "dependents",
    title: "Family & dependents",
    icon: "Users",
    description: "Children and others you support.",
    dependsOn: (a: Answers) => truthy(a.ls_deps),
  },
  {
    id: "income-job",
    title: "Job income",
    icon: "Briefcase",
    description: "Wages from your W-2.",
    dependsOn: (a: Answers) => truthy(a.ls_job),
  },
  {
    id: "income-self",
    title: "Self-employment",
    icon: "Store",
    description: "Freelance or business income.",
    dependsOn: (a: Answers) => truthy(a.ls_self),
  },
  {
    id: "income-investments",
    title: "Investments",
    icon: "TrendingUp",
    description: "Interest, dividends, and sales.",
    dependsOn: (a: Answers) => truthy(a.ls_invest),
  },
  {
    id: "income-retirement",
    title: "Retirement & Social Security",
    icon: "PiggyBank",
    description: "Pensions, IRAs, and benefits.",
    dependsOn: (a: Answers) => truthy(a.ls_retire),
  },
  { id: "income-other", title: "Other income", icon: "Coins", description: "Anything else taxable." },
  { id: "adjustments", title: "Adjustments", icon: "Sliders", description: "Above-the-line deductions." },
  { id: "deductions", title: "Deductions", icon: "Receipt", description: "Standard vs. itemized." },
  {
    id: "credits",
    title: "Credits",
    icon: "Gift",
    description: "Care, education, savings, and energy.",
    dependsOn: (a: Answers) =>
      truthy(a.ls_care) || truthy(a.ls_education) || truthy(a.ls_energy) || truthy(a.ls_savings),
  },
  { id: "payments", title: "Payments", icon: "Wallet", description: "Withholding and estimates." },
]

/** Life Situations options — checking these unlocks the relevant sections. */
export const LIFE_SITUATIONS: Array<{ id: string; label: string; icon: string }> = [
  { id: "ls_job", label: "I earned wages from a job (W-2)", icon: "Briefcase" },
  { id: "ls_self", label: "I was self-employed or freelanced", icon: "Store" },
  { id: "ls_invest", label: "I had investments (interest, dividends, or sales)", icon: "TrendingUp" },
  { id: "ls_retire", label: "I received retirement income or Social Security", icon: "PiggyBank" },
  { id: "ls_deps", label: "I have children or other dependents", icon: "Users" },
  { id: "ls_itemize", label: "I owned a home or have large deductions", icon: "Home" },
  { id: "ls_education", label: "I paid for higher education", icon: "GraduationCap" },
  { id: "ls_care", label: "I paid for child or dependent care", icon: "Baby" },
  { id: "ls_savings", label: "I contributed to an IRA, HSA, or retirement plan", icon: "Landmark" },
  { id: "ls_energy", label: "I bought an EV or made home energy upgrades", icon: "Zap" },
]
