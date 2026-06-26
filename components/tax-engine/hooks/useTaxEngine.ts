"use client"

import { useCallback, useEffect, useMemo, useReducer } from "react"
import type { Answers, AnswerValue } from "../types/question"
import { QUESTION_BANK } from "../questions/questionBank"
import { pruneHidden } from "../questions/questionRouter"
import { buildReturn } from "../questions/buildReturn"
import { calculateFederalTax } from "../engine/calculator"

const STORAGE_KEY = "finnacalc:taxReturn:2024:answers"

/** Question ids marked sensitive — never written to localStorage. */
const SENSITIVE_IDS = new Set(QUESTION_BANK.filter((q) => q.sensitive).map((q) => q.id))

type Action =
  | { type: "SET"; id: string; value: AnswerValue }
  | { type: "LOAD"; answers: Answers }
  | { type: "RESET" }

function reducer(state: Answers, action: Action): Answers {
  switch (action.type) {
    case "SET":
      return pruneHidden({ ...state, [action.id]: action.value })
    case "LOAD":
      return pruneHidden({ ...state, ...action.answers })
    case "RESET":
      return {}
    default:
      return state
  }
}

/** Strip sensitive answers before persisting. */
function redactForPersistence(answers: Answers): Answers {
  const out: Answers = {}
  for (const [k, v] of Object.entries(answers)) {
    if (!SENSITIVE_IDS.has(k)) out[k] = v
  }
  return out
}

export function useTaxEngine() {
  const [answers, dispatch] = useReducer(reducer, {})

  // Hydrate from localStorage on mount.
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) dispatch({ type: "LOAD", answers: JSON.parse(raw) as Answers })
    } catch {
      /* ignore corrupt storage */
    }
  }, [])

  // Persist (redacted) on every change.
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(redactForPersistence(answers)))
    } catch {
      /* ignore quota / serialization errors */
    }
  }, [answers])

  const setAnswer = useCallback((id: string, value: AnswerValue) => {
    dispatch({ type: "SET", id, value })
  }, [])

  const reset = useCallback(() => {
    dispatch({ type: "RESET" })
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
  }, [])

  const taxReturn = useMemo(() => buildReturn(answers), [answers])
  const result = useMemo(() => calculateFederalTax(taxReturn), [taxReturn])

  return { answers, setAnswer, reset, taxReturn, result }
}
