/**
 * Pure adaptive-interview router. All functions are deterministic over the live
 * answers, so the UI can recompute the visible set on every change.
 */
import type { Answers, Question, Section } from "../types/question"
import { QUESTION_BANK } from "./questionBank"
import { SECTIONS } from "./sections"

const sectionById = new Map(SECTIONS.map((s) => [s.id, s]))

/** Is a single question currently visible (its section shows AND its own gate passes)? */
export function isQuestionVisible(q: Question, a: Answers): boolean {
  const section = sectionById.get(q.sectionId)
  if (section?.dependsOn && !section.dependsOn(a)) return false
  return !q.dependsOn || q.dependsOn(a)
}

/** Sections that currently have at least one... well, that pass their gate. */
export function getVisibleSections(a: Answers): Section[] {
  return SECTIONS.filter((s) => !s.dependsOn || s.dependsOn(a))
}

/** Visible questions for a given section, in bank order. */
export function getQuestionsForSection(sectionId: string, a: Answers): Question[] {
  return QUESTION_BANK.filter((q) => q.sectionId === sectionId && isQuestionVisible(q, a))
}

/** All visible questions across all visible sections. */
export function getVisibleQuestions(a: Answers): Question[] {
  return QUESTION_BANK.filter((q) => isQuestionVisible(q, a))
}

/**
 * Remove answers whose questions are no longer visible (e.g. the user unchecked a
 * life situation, or switched filing status away from MFS). This prevents hidden,
 * stale values from polluting the calculation. Life-situation toggles (ls_*) and
 * any non-bank keys are preserved. Returns a new answers object.
 */
export function pruneHidden(a: Answers): Answers {
  const next: Answers = {}
  const bankIds = new Set(QUESTION_BANK.map((q) => q.id))
  for (const [key, value] of Object.entries(a)) {
    if (!bankIds.has(key)) {
      next[key] = value // ls_* and other non-question keys are kept
      continue
    }
    const q = QUESTION_BANK.find((x) => x.id === key)!
    if (isQuestionVisible(q, a)) next[key] = value
  }
  return next
}

/** Progress over the visible sections (0–100), given how many have been visited. */
export function getProgress(visitedSectionIds: string[], a: Answers): number {
  const visible = getVisibleSections(a)
  if (visible.length === 0) return 0
  const visited = visible.filter((s) => visitedSectionIds.includes(s.id)).length
  return Math.round((visited / visible.length) * 100)
}
