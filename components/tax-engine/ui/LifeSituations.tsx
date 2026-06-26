"use client"

import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Check } from "lucide-react"
import { LIFE_SITUATIONS } from "../questions/sections"
import type { Answers, AnswerValue } from "../types/question"
import { ICONS } from "./icons"

/**
 * "Check all that apply" intro screen. Selecting a situation unlocks the matching
 * interview sections, so nobody is asked questions that don't apply to them.
 */
export function LifeSituations({
  answers,
  setAnswer,
}: {
  answers: Answers
  setAnswer: (id: string, value: AnswerValue) => void
}) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-foreground">Let&apos;s start with your 2024</h2>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Pick everything that happened to you in 2024. We&apos;ll only ask about what applies —
          and your estimated refund updates as you go.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {LIFE_SITUATIONS.map((ls) => {
          const Icon = ICONS[ls.icon] ?? Check
          const selected = answers[ls.id] === true
          return (
            <Card
              key={ls.id}
              role="button"
              tabIndex={0}
              onClick={() => setAnswer(ls.id, !selected)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  setAnswer(ls.id, !selected)
                }
              }}
              className={cn(
                "flex items-center gap-3 p-4 cursor-pointer transition-colors border",
                selected
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40",
              )}
            >
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                  selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <span className="text-sm font-medium text-foreground">{ls.label}</span>
              {selected && <Check className="ml-auto h-5 w-5 text-primary" />}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
