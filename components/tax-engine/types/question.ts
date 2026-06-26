/**
 * Adaptive interview primitives.
 *
 * The interview collects a flat `Answers` record keyed by question id. A pure
 * `buildReturn(answers)` converts those answers into the canonical TaxReturn2024
 * the engine consumes. Each question's `dependsOn` predicate runs over the live
 * answers, so the visible set recomputes on every change and irrelevant questions
 * simply disappear.
 */
export type AnswerValue = string | number | boolean
export type Answers = Record<string, AnswerValue>

export type InputType = "boolean" | "dollar" | "integer" | "select" | "text"

export interface QuestionOption {
  value: string
  label: string
}

export interface Question {
  id: string
  sectionId: string
  /** Plain-English label, phrased like TurboTax — not government-form language. */
  text: string
  /** "Why we ask" + the IRS form/line this feeds. */
  helpText?: string
  inputType: InputType
  options?: QuestionOption[]
  placeholder?: string
  /** Pure predicate over the live answers — true means show this question. */
  dependsOn?: (a: Answers) => boolean
  /** SENSITIVE (SSN, bank) — never persisted to localStorage. */
  sensitive?: boolean
  /** Allow negative values (e.g. capital gains/losses). */
  allowNegative?: boolean
}

export interface Section {
  id: string
  title: string
  description?: string
  /** lucide-react icon name. */
  icon?: string
  /** Section-level gate — hidden entirely when false. */
  dependsOn?: (a: Answers) => boolean
}
