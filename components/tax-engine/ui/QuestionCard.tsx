"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { AnswerValue, Question } from "../types/question"

/** Renders a single interview question by its input type. Generic over the bank. */
export function QuestionCard({
  question,
  value,
  onChange,
}: {
  question: Question
  value: AnswerValue | undefined
  onChange: (value: AnswerValue) => void
}) {
  const { inputType } = question

  if (inputType === "boolean") {
    return (
      <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-4">
        <div className="space-y-1">
          <Label className="text-sm font-medium">{question.text}</Label>
          {question.helpText && (
            <p className="text-xs text-muted-foreground">{question.helpText}</p>
          )}
        </div>
        <Switch checked={value === true} onCheckedChange={(c) => onChange(c === true)} />
      </div>
    )
  }

  if (inputType === "select") {
    return (
      <div className="space-y-2 rounded-lg border border-border p-4">
        <Label className="text-sm font-medium">{question.text}</Label>
        {question.helpText && (
          <p className="text-xs text-muted-foreground">{question.helpText}</p>
        )}
        <Select
          value={typeof value === "string" ? value : ""}
          onValueChange={(v) => onChange(v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            {question.options?.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  }

  // dollar / integer / text
  const isNumeric = inputType === "dollar" || inputType === "integer"
  return (
    <div className="space-y-2 rounded-lg border border-border p-4">
      <Label className="text-sm font-medium">{question.text}</Label>
      {question.helpText && <p className="text-xs text-muted-foreground">{question.helpText}</p>}
      <div className="relative">
        {inputType === "dollar" && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            $
          </span>
        )}
        <Input
          type={isNumeric ? "number" : "text"}
          inputMode={inputType === "dollar" ? "decimal" : inputType === "integer" ? "numeric" : "text"}
          min={isNumeric && !question.allowNegative ? "0" : undefined}
          step={inputType === "integer" ? "1" : undefined}
          className={inputType === "dollar" ? "pl-7" : undefined}
          placeholder={question.placeholder ?? (inputType === "dollar" ? "0.00" : "")}
          value={value === undefined || value === null ? "" : String(value)}
          onChange={(e) => {
            const raw = e.target.value
            if (!isNumeric) {
              onChange(raw)
              return
            }
            if (raw === "") {
              onChange(0)
              return
            }
            const parsed = Number.parseFloat(raw)
            onChange(Number.isFinite(parsed) ? parsed : 0)
          }}
        />
      </div>
    </div>
  )
}
