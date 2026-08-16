import { describe, it, expect } from "vitest"
import {
  getQuestionsForSection,
  getVisibleSections,
  isQuestionVisible,
  pruneHidden,
} from "../../questions/questionRouter"
import { QUESTION_BANK } from "../../questions/questionBank"
import type { Answers } from "../../types/question"

const ids = (xs: { id: string }[]) => xs.map((x) => x.id)

describe("adaptive question router", () => {
  it("hides gated sections until their life situation is checked", () => {
    const base = getVisibleSections({})
    expect(ids(base)).not.toContain("income-job")
    expect(ids(base)).toContain("about-you") // always shown

    const withJob = getVisibleSections({ ls_job: true })
    expect(ids(withJob)).toContain("income-job")
  })

  it("shows the MFS 'lived apart' question only for MFS filers", () => {
    const q = QUESTION_BANK.find((x) => x.id === "q_lived_apart")!
    expect(isQuestionVisible(q, { q_filing: "single" })).toBe(false)
    expect(isQuestionVisible(q, { q_filing: "mfs" })).toBe(true)
  })

  it("reveals itemized fields only when the user opts to itemize", () => {
    const noItemize = getQuestionsForSection("deductions", {})
    expect(ids(noItemize)).toEqual(["q_itemize"])
    const itemize = getQuestionsForSection("deductions", { q_itemize: true })
    expect(ids(itemize)).toContain("q_mortgage_interest")
  })

  it("reveals the early-withdrawal question only when there are taxable distributions", () => {
    const q = QUESTION_BANK.find((x) => x.id === "q_retire_early")!
    expect(isQuestionVisible(q, { ls_retire: true })).toBe(false)
    expect(isQuestionVisible(q, { ls_retire: true, q_retire_taxable: 5000 })).toBe(true)
  })

  it("prunes answers for questions that are no longer visible", () => {
    // Wages entered, then the job life-situation is turned off.
    const answers: Answers = { ls_job: true, q_wages: 50000 }
    expect(pruneHidden(answers).q_wages).toBe(50000)

    const turnedOff: Answers = { ls_job: false, q_wages: 50000 }
    const pruned = pruneHidden(turnedOff)
    expect(pruned.q_wages).toBeUndefined()
    expect(pruned.ls_job).toBe(false) // life-situation key is preserved
  })

  it("prunes itemized answers when the user switches back to standard", () => {
    const answers: Answers = { q_itemize: false, q_mortgage_interest: 12000 }
    expect(pruneHidden(answers).q_mortgage_interest).toBeUndefined()
  })
})
