"use client"

import { useMemo, useState } from "react"
import { ArrowLeft, ArrowRight, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useTaxEngine } from "../hooks/useTaxEngine"
import { getQuestionsForSection, getVisibleSections } from "../questions/questionRouter"
import { QuestionCard } from "./QuestionCard"
import { RefundMeter } from "./RefundMeter"
import { LifeSituations } from "./LifeSituations"
import { ReviewScreen } from "./ReviewScreen"
import { FilingScreen } from "./FilingScreen"
import { ICONS } from "./icons"

type Phase = "life" | "sections" | "review" | "filing"

/**
 * The adaptive tax interview. Default export — replaces the legacy
 * tax-filing-interface, preserving the `{ onBack }` prop contract.
 */
export default function TaxInterview({ onBack }: { onBack?: () => void }) {
  const { answers, setAnswer, reset, result } = useTaxEngine()
  const [phase, setPhase] = useState<Phase>("life")
  const [sectionIndex, setSectionIndex] = useState(0)

  const visibleSections = useMemo(() => getVisibleSections(answers), [answers])
  const clampedIndex = Math.min(sectionIndex, visibleSections.length - 1)
  const currentSection = visibleSections[clampedIndex]
  const currentQuestions = useMemo(
    () => (currentSection ? getQuestionsForSection(currentSection.id, answers) : []),
    [currentSection, answers],
  )

  const goToSection = (id: string) => {
    const idx = visibleSections.findIndex((s) => s.id === id)
    setSectionIndex(idx >= 0 ? idx : 0)
    setPhase("sections")
  }

  const next = () => {
    if (clampedIndex < visibleSections.length - 1) setSectionIndex(clampedIndex + 1)
    else setPhase("review")
  }
  const back = () => {
    if (clampedIndex > 0) setSectionIndex(clampedIndex - 1)
    else setPhase("life")
  }

  const progress =
    phase === "life"
      ? 0
      : phase === "sections"
        ? Math.round(((clampedIndex + 1) / (visibleSections.length + 1)) * 100)
        : 100

  const SectionIcon = currentSection ? (ICONS[currentSection.icon ?? ""] ?? null) : null

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-end gap-2">
          <Badge variant="secondary">IRS-accurate</Badge>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm">
                <RotateCcw className="h-4 w-4 mr-1.5" />
                Start over
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Start over?</AlertDialogTitle>
                <AlertDialogDescription>
                  This clears every answer you&apos;ve entered and resets your estimate. This
                  can&apos;t be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep my answers</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    reset()
                    setPhase("life")
                    setSectionIndex(0)
                  }}
                >
                  Start over
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
      </div>

      {phase !== "life" && <Progress value={progress} className="h-2" />}

      <div className="grid gap-6 grid-cols-2 items-start">
        <div className="space-y-6">
          {phase === "life" && (
            <>
              <LifeSituations answers={answers} setAnswer={setAnswer} />
              <div className="flex justify-end">
                <Button onClick={() => setPhase("sections")} className="bg-blue-600 hover:bg-blue-700">
                  Continue <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </>
          )}

          {phase === "sections" && currentSection && (
            <>
              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {SectionIcon && <SectionIcon className="h-5 w-5 text-primary" />}
                    {currentSection.title}
                  </CardTitle>
                  {currentSection.description && (
                    <CardDescription>{currentSection.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  {currentQuestions.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Nothing to enter here based on your answers — continue.
                    </p>
                  )}
                  {currentQuestions.map((q) => (
                    <QuestionCard
                      key={q.id}
                      question={q}
                      value={answers[q.id]}
                      onChange={(v) => setAnswer(q.id, v)}
                    />
                  ))}
                </CardContent>
              </Card>

              <div className="flex justify-between">
                <Button variant="outline" onClick={back}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button onClick={next} className="bg-blue-600 hover:bg-blue-700">
                  {clampedIndex < visibleSections.length - 1 ? "Next" : "Review"}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </>
          )}

          {phase === "review" && (
            <ReviewScreen
              result={result}
              answers={answers}
              sections={visibleSections}
              onEdit={goToSection}
              onFile={() => setPhase("filing")}
            />
          )}

          {phase === "filing" && <FilingScreen result={result} onBack={() => setPhase("review")} />}
        </div>

        {/* Live meter (hidden on the filing step) */}
        {phase !== "filing" && (
          <div>
            <RefundMeter result={result} />
            {phase === "sections" && (
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Step {clampedIndex + 1} of {visibleSections.length}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
