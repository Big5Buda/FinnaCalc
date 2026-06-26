"use client"

import { Lightbulb } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Answers } from "../types/question"
import type { TaxCalculationResult } from "../types/result"

/** Heuristic "you might also qualify for…" nudges based on the answers + result. */
export function computeSuggestions(a: Answers, result: TaxCalculationResult): string[] {
  const out: string[] = []
  const hasKids = (typeof a.q_qual_children === "number" ? a.q_qual_children : 0) > 0

  if (hasKids && a.ls_care !== true) {
    out.push(
      "You have children — if you paid for daycare or after-school care, check “I paid for child or dependent care” to claim the Child & Dependent Care Credit.",
    )
  }
  if (hasKids && a.ls_education !== true) {
    out.push(
      "Paying for college? Check “I paid for higher education” — the American Opportunity Credit is worth up to $2,500 per student.",
    )
  }
  if (a.ls_self === true && a.ls_savings !== true) {
    out.push(
      "As a self-employed filer, contributing to a SEP-IRA or solo 401(k) can lower your taxable income — check “I contributed to an IRA, HSA, or retirement plan.”",
    )
  }
  if (a.ls_savings !== true && result.agi > 0 && result.agi < 40_000) {
    out.push(
      "At your income, retirement contributions may earn the Saver's Credit (up to 50% back). Check “I contributed to an IRA, HSA, or retirement plan.”",
    )
  }
  if (result.deductionUsed === "standard" && a.ls_itemize !== true) {
    out.push(
      "We used the standard deduction. If you own a home or made large charitable gifts, check “I owned a home or have large deductions” to compare itemizing.",
    )
  }
  return out
}

export function SmartSuggestions({ suggestions }: { suggestions: string[] }) {
  if (suggestions.length === 0) return null
  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Lightbulb className="h-5 w-5 text-primary" />
          You might be leaving money on the table
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {suggestions.map((s, i) => (
            <li key={i} className="flex gap-2 text-sm text-muted-foreground">
              <span className="text-primary">•</span>
              <span>{s}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
