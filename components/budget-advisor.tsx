"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Sparkles, RefreshCw, Send, TrendingUp, AlertCircle } from "lucide-react"

interface CategorySlice {
    name: string
    value: number
}
interface Goal {
    name: string
    targetAmount: number
    currentAmount: number
    monthlyContribution: number
    targetDate: string
}

interface BudgetAdvisorProps {
    budgetType: "personal" | "business"
    monthlyIncome: number
    monthlyExpenses: number
    monthlyNet: number
    expenseByCategory: CategorySlice[]
    incomeByCategory: CategorySlice[]
    savingsGoals: Goal[]
}

type Depth = "quick" | "deep"
type Message = { id: string; role: "user" | "assistant"; content: string }

function uid() {
    return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2)
}

const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })

// ─── Lightweight Markdown renderer (headings, bold, bullets, numbered lists) ─────

function renderInline(text: string, keyBase: string) {
    const parts = text.split(/(\*\*[^*]+\*\*)/g)
    return parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") ? (
            <strong key={`${keyBase}-${i}`}>{p.slice(2, -2)}</strong>
        ) : (
            <span key={`${keyBase}-${i}`}>{p.replace(/\*/g, "")}</span>
        )
    )
}

function Markdown({ text }: { text: string }) {
    const lines = text.split("\n")
    const blocks: React.ReactNode[] = []
    let list: { ordered: boolean; items: string[] } | null = null

    const flushList = (key: string) => {
        if (!list) return
        const Tag = list.ordered ? "ol" : "ul"
        blocks.push(
            <Tag key={key} className={`${list.ordered ? "list-decimal" : "list-disc"} pl-5 space-y-1 my-2`}>
                {list.items.map((it, i) => (
                    <li key={i}>{renderInline(it, `${key}-${i}`)}</li>
                ))}
            </Tag>
        )
        list = null
    }

    lines.forEach((raw, idx) => {
        const line = raw.trimEnd()
        if (!line.trim()) {
            flushList(`l-${idx}`)
            return
        }
        const h = line.match(/^(#{1,4})\s+(.*)$/)
        if (h) {
            flushList(`l-${idx}`)
            const level = h[1].length
            const cls = level <= 2 ? "text-base font-bold mt-4 mb-1" : "text-sm font-semibold mt-3 mb-1"
            blocks.push(<p key={`h-${idx}`} className={cls}>{renderInline(h[2], `h-${idx}`)}</p>)
            return
        }
        const ol = line.match(/^\s*\d+[.)]\s+(.*)$/)
        const ul = line.match(/^\s*[-*•]\s+(.*)$/)
        if (ol) {
            if (!list || !list.ordered) { flushList(`l-${idx}`); list = { ordered: true, items: [] } }
            list.items.push(ol[1])
            return
        }
        if (ul) {
            if (!list || list.ordered) { flushList(`l-${idx}`); list = { ordered: false, items: [] } }
            list.items.push(ul[1])
            return
        }
        flushList(`l-${idx}`)
        const em = line.match(/^_(.*)_$|^\*(.*)\*$/)
        if (em) {
            blocks.push(<p key={`p-${idx}`} className="text-xs text-muted-foreground italic mt-3">{em[1] ?? em[2]}</p>)
            return
        }
        blocks.push(<p key={`p-${idx}`} className="my-1.5 leading-relaxed">{renderInline(line, `p-${idx}`)}</p>)
    })
    flushList("l-end")
    return <div className="text-sm">{blocks}</div>
}

// ─── Component ───────────────────────────────────────────────────────────────────

export default function BudgetAdvisor({
    budgetType,
    monthlyIncome,
    monthlyExpenses,
    monthlyNet,
    expenseByCategory,
    incomeByCategory,
    savingsGoals,
}: BudgetAdvisorProps) {
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [depth, setDepth] = useState<Depth>("quick")
    const [error, setError] = useState<string | null>(null)
    const scrollRef = useRef<HTMLDivElement>(null)
    const autoRan = useRef(false)

    const savingsRate = monthlyIncome > 0 ? (monthlyNet / monthlyIncome) * 100 : 0
    const totalSaved = savingsGoals.reduce((s, g) => s + (g.currentAmount || 0), 0)
    const emergencyMonths = monthlyExpenses > 0 ? totalSaved / monthlyExpenses : 0
    const topCategories = useMemo(
        () => [...expenseByCategory].sort((a, b) => b.value - a.value).slice(0, 3),
        [expenseByCategory]
    )
    const hasData = monthlyIncome > 0 || monthlyExpenses > 0

    const snapshot = useMemo(
        () => ({
            budgetType,
            monthlyIncome: Math.round(monthlyIncome),
            monthlyExpenses: Math.round(monthlyExpenses),
            monthlyNet: Math.round(monthlyNet),
            savingsRatePct: Math.round(savingsRate * 10) / 10,
            expenseByCategory: expenseByCategory.map((c) => ({
                category: c.name,
                amount: Math.round(c.value),
                pctOfIncome: monthlyIncome > 0 ? Math.round((c.value / monthlyIncome) * 1000) / 10 : null,
            })),
            incomeByCategory: incomeByCategory.map((c) => ({ source: c.name, amount: Math.round(c.value) })),
            savingsGoals: savingsGoals.map((g) => ({
                name: g.name,
                target: g.targetAmount,
                saved: g.currentAmount,
                monthlyContribution: g.monthlyContribution,
                targetDate: g.targetDate,
                pctComplete: g.targetAmount > 0 ? Math.round((g.currentAmount / g.targetAmount) * 100) : 0,
            })),
            totalSavedAcrossGoals: Math.round(totalSaved),
            emergencyFundMonthsCovered: Math.round(emergencyMonths * 10) / 10,
        }),
        [budgetType, monthlyIncome, monthlyExpenses, monthlyNet, savingsRate, expenseByCategory, incomeByCategory, savingsGoals, totalSaved, emergencyMonths]
    )

    const stream = async (history: Message[], d: Depth) => {
        setIsLoading(true)
        setError(null)
        const assistantId = uid()
        try {
            const res = await fetch("/api/budget-advisor", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    snapshot,
                    depth: d,
                    messages: history.map(({ role, content }) => ({ role, content })),
                }),
            })
            if (!res.ok || !res.body) {
                const detail = await res.text().catch(() => "")
                throw new Error(detail || `Request failed (${res.status}).`)
            }
            setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }])
            const reader = res.body.getReader()
            const decoder = new TextDecoder()
            let acc = ""
            while (true) {
                const { done, value } = await reader.read()
                if (done) break
                acc += decoder.decode(value, { stream: true })
                setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: acc } : m)))
                scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
            }
            if (!acc.trim()) {
                setMessages((prev) => prev.filter((m) => m.id !== assistantId))
                throw new Error("No response received. Please try again.")
            }
        } catch (e: any) {
            setMessages((prev) => prev.filter((m) => m.id !== assistantId))
            setError(e?.message ?? "Something went wrong.")
        } finally {
            setIsLoading(false)
        }
    }

    const runAnalysis = (d: Depth) => {
        if (isLoading) return
        setDepth(d)
        const seed: Message[] = [
            {
                id: uid(),
                role: "user",
                content:
                    d === "deep"
                        ? "Give me a full, deep analysis of my budget with your best personalized recommendations."
                        : "Give me a quick, concise summary of my budget with the top quick wins.",
            },
        ]
        setMessages(seed)
        stream(seed, d)
    }

    // Auto-load a concise analysis on first open (once), when there's data.
    useEffect(() => {
        if (!autoRan.current && hasData) {
            autoRan.current = true
            runAnalysis("quick")
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasData])

    const send = () => {
        const trimmed = input.trim()
        if (!trimmed || isLoading) return
        const next = [...messages, { id: uid(), role: "user" as const, content: trimmed }]
        setMessages(next)
        setInput("")
        stream(next, depth)
    }

    // Hide the seed "analyze" user message from the transcript for a cleaner look.
    const visible = messages.filter((m, i) => !(i === 0 && m.role === "user"))

    return (
        <div className="space-y-6">
            {/* Budget Health snapshot + Deep Analysis trigger */}
            <Card>
                <CardHeader className="pb-3 border-b border-border">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                                <Sparkles className="h-4 w-4 text-white" />
                            </div>
                            <div>
                                <CardTitle className="text-lg leading-tight">Budget Analysis</CardTitle>
                                <p className="text-xs text-muted-foreground">Personalized insights for your {budgetType} budget · powered by Gemini</p>
                            </div>
                        </div>
                        {hasData && (
                            <Button onClick={() => runAnalysis("deep")} disabled={isLoading} className="bg-blue-600 hover:bg-blue-700">
                                <Sparkles className="h-4 w-4 mr-2" />
                                Deep Analysis
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="pt-5">
                    {!hasData ? (
                        <div className="text-center py-8">
                            <TrendingUp className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                            <p className="text-sm text-muted-foreground">
                                Add some income and expenses in the Budget tab, then come back for a personalized analysis.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-4 gap-3">
                            <div className="rounded-lg border border-border p-3">
                                <p className="text-xs text-muted-foreground">Monthly net</p>
                                <p className={`text-lg font-bold ${monthlyNet >= 0 ? "text-emerald-600" : "text-red-500"}`}>{money(monthlyNet)}</p>
                            </div>
                            <div className="rounded-lg border border-border p-3">
                                <p className="text-xs text-muted-foreground">Savings rate</p>
                                <p className={`text-lg font-bold ${savingsRate >= 20 ? "text-emerald-600" : savingsRate >= 0 ? "text-amber-600" : "text-red-500"}`}>{savingsRate.toFixed(0)}%</p>
                            </div>
                            <div className="rounded-lg border border-border p-3">
                                <p className="text-xs text-muted-foreground">Top expense</p>
                                <p className="text-lg font-bold truncate">{topCategories[0]?.name ?? "—"}</p>
                            </div>
                            <div className="rounded-lg border border-border p-3">
                                <p className="text-xs text-muted-foreground">Emergency runway</p>
                                <p className="text-lg font-bold">{emergencyMonths > 0 ? `${emergencyMonths.toFixed(1)} mo` : "—"}</p>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Analysis + chat */}
            {(messages.length > 0 || isLoading) && (
                <Card>
                    <CardContent className="p-0">
                        <div ref={scrollRef} className="max-h-[640px] overflow-y-auto p-5 space-y-5">
                            {visible.map((m) =>
                                m.role === "assistant" ? (
                                    <div key={m.id} className="prose-sm max-w-none">
                                        <Markdown text={m.content} />
                                    </div>
                                ) : (
                                    <div key={m.id} className="flex justify-end">
                                        <div className="bg-blue-600 text-white rounded-2xl rounded-br-sm px-3 py-2 text-sm max-w-[85%]">
                                            {m.content}
                                        </div>
                                    </div>
                                )
                            )}
                            {isLoading && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <RefreshCw className="h-4 w-4 animate-spin" /> {depth === "deep" ? "Running a deep analysis…" : "Analyzing your budget…"}
                                </div>
                            )}
                            {error && (
                                <div className="flex items-start gap-2 text-xs text-red-600 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                                    <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                                    <span>{error}</span>
                                </div>
                            )}
                        </div>

                        <div className="border-t border-border p-3">
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && !e.shiftKey) {
                                            e.preventDefault()
                                            send()
                                        }
                                    }}
                                    placeholder="Ask a follow-up — e.g. how do I free up $300/month?"
                                    disabled={isLoading}
                                    className="flex-1 rounded-full border border-border bg-background px-4 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
                                />
                                <Button onClick={send} disabled={isLoading || !input.trim()} size="sm" className="rounded-full h-9 w-9 p-0 bg-blue-600 hover:bg-blue-700" aria-label="Send">
                                    <Send className="h-4 w-4 text-white" />
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
