"use client"

import { ArrowRight, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { formatCurrency } from "@/lib/format"
import type { Answers } from "../types/question"
import type { Section } from "../types/question"
import type { TaxCalculationResult } from "../types/result"
import { AuditRiskPanel } from "./AuditRiskPanel"
import { Disclaimer } from "./Disclaimer"
import { SmartSuggestions, computeSuggestions } from "./SmartSuggestions"

export function ReviewScreen({
  result,
  answers,
  sections,
  onEdit,
  onFile,
}: {
  result: TaxCalculationResult
  answers: Answers
  sections: Section[]
  onEdit: (sectionId: string) => void
  onFile: () => void
}) {
  const suggestions = computeSuggestions(answers, result)

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-bold text-foreground">Review your 2024 estimate</h2>
        <p className="text-muted-foreground">
          {result.owes
            ? `You owe an estimated ${formatCurrency(Math.abs(result.refundOrOwed), { cents: false })}.`
            : `You're getting an estimated ${formatCurrency(result.refundOrOwed, { cents: false })} refund.`}
        </p>
      </div>

      <SmartSuggestions suggestions={suggestions} />

      {/* Deduction optimizer */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Deduction check</CardTitle>
          <CardDescription>
            Standard {formatCurrency(result.standardDeduction, { cents: false })} vs. itemized{" "}
            {formatCurrency(result.itemizedDeduction, { cents: false })} —{" "}
            {result.deductionUsed === "itemized"
              ? `we itemized and saved you about ${formatCurrency(result.itemizedSavings, { cents: false })}.`
              : "the standard deduction is better for you."}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Section edit list */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Your answers</CardTitle>
          <CardDescription>Jump back to any section to make changes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {sections.map((s) => (
            <div key={s.id} className="flex items-center justify-between py-1">
              <span className="text-sm text-foreground">{s.title}</span>
              <Button variant="ghost" size="sm" onClick={() => onEdit(s.id)}>
                <Pencil className="h-3.5 w-3.5 mr-1.5" />
                Edit
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Full line-by-line return */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Your 1040, line by line</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {result.trace.map((t) => (
            <div key={t.id} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {t.label}
                <span className="ml-2 text-xs text-muted-foreground/70">{t.formRef}</span>
              </span>
              <span className="font-medium tabular-nums text-foreground">
                {formatCurrency(t.amount)}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <AuditRiskPanel result={result} />
      <Disclaimer />

      <Separator />
      <div className="flex justify-end">
        <Button onClick={onFile} className="bg-blue-600 hover:bg-blue-700">
          Continue to filing <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  )
}
