"use client"

import { useMemo, useState, type FormEvent } from "react"
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Loader2, Lock } from "lucide-react"
import { compoundInterest } from "@finnacalc/shared/calculators"
import { currency, fixed } from "@finnacalc/shared/format"
import { beginHandoff } from "@/lib/auth-handoff"
import { Button, Dialog, DialogContent, DialogTrigger, Slider, TextField } from "@/components/ui"
import { cn } from "@/lib/utils"

/**
 * The un-gated calculator. Anyone can drag the sliders and watch the chart and
 * the figures move — no account, no email, nothing stored.
 *
 * The math is `compoundInterest` from @finnacalc/shared, the same function the
 * app's calculator screen calls, so the number a visitor sees here is the
 * number they'll see after signing up. A second implementation for the demo
 * would eventually disagree with the product, which is worse than no demo.
 *
 * Gating is deliberately narrow: only "Save this scenario" asks for an account,
 * because saving is the only thing here that genuinely needs one. Export and
 * API buttons would be gates in front of features that don't exist yet.
 */

const YEARS_MAX = 40

export function CalculatorWidget() {
    const [initial, setInitial] = useState(5000)
    const [monthly, setMonthly] = useState(400)
    const [rate, setRate] = useState(7)
    const [years, setYears] = useState(20)

    const results = compoundInterest({
        initialDeposit: initial,
        monthlyContribution: monthly,
        annualRate: rate,
        years,
    })

    /** Balance year by year, on the same monthly compounding the math uses. */
    const series = useMemo(() => {
        const monthlyRate = rate / 100 / 12
        let balance = initial
        const points = [{ year: 0, balance: initial, contributed: initial }]
        for (let year = 1; year <= years; year++) {
            for (let month = 0; month < 12; month++) {
                balance = balance * (1 + monthlyRate) + monthly
            }
            points.push({
                year,
                balance: Math.round(balance),
                contributed: Math.round(initial + monthly * 12 * year),
            })
        }
        return points
    }, [initial, monthly, rate, years])

    return (
        <div className="grid gap-6 rounded-2xl border border-border bg-card p-6 shadow-sm lg:grid-cols-[minmax(0,320px)_1fr] lg:p-8">
            <div className="flex flex-col gap-6">
                <SliderRow
                    label="Starting amount"
                    value={initial}
                    onChange={setInitial}
                    min={0}
                    max={100000}
                    step={500}
                    display={currency(initial)}
                />
                <SliderRow
                    label="Monthly contribution"
                    value={monthly}
                    onChange={setMonthly}
                    min={0}
                    max={5000}
                    step={25}
                    display={currency(monthly)}
                />
                <SliderRow
                    label="Annual return"
                    value={rate}
                    onChange={setRate}
                    min={0}
                    max={15}
                    step={0.1}
                    display={`${fixed(rate, 1)}%`}
                />
                <SliderRow
                    label="Years"
                    value={years}
                    onChange={setYears}
                    min={1}
                    max={YEARS_MAX}
                    step={1}
                    display={`${years} ${years === 1 ? "year" : "years"}`}
                />

                <SaveGate
                    scenario={{ calculator: "compound-interest", initial, monthly, rate, years }}
                />
            </div>

            <div className="flex flex-col gap-5">
                <div className="h-[260px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                            <defs>
                                <linearGradient id="balance" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="rgb(var(--primary))" stopOpacity={0.35} />
                                    <stop offset="100%" stopColor="rgb(var(--primary))" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid stroke="rgb(var(--border))" vertical={false} />
                            <XAxis
                                dataKey="year"
                                tickLine={false}
                                axisLine={false}
                                tick={{ fill: "rgb(var(--muted-foreground))", fontSize: 11 }}
                                tickFormatter={(year: number) => (year === 0 ? "now" : `${year}y`)}
                            />
                            <YAxis
                                width={54}
                                tickLine={false}
                                axisLine={false}
                                tick={{ fill: "rgb(var(--muted-foreground))", fontSize: 11 }}
                                tickFormatter={(value: number) =>
                                    value >= 1000 ? `$${Math.round(value / 1000)}k` : `$${value}`
                                }
                            />
                            <Tooltip
                                cursor={{ stroke: "rgb(var(--border-strong))" }}
                                contentStyle={{
                                    background: "rgb(var(--card))",
                                    border: "1px solid rgb(var(--border))",
                                    borderRadius: 12,
                                    fontSize: 12,
                                }}
                                formatter={(value: number, name) => [
                                    currency(value),
                                    name === "balance" ? "Balance" : "You put in",
                                ]}
                                labelFormatter={(year: number) => (year === 0 ? "Today" : `Year ${year}`)}
                            />
                            <Area
                                type="monotone"
                                dataKey="contributed"
                                stroke="rgb(var(--border-strong))"
                                strokeDasharray="4 4"
                                fill="none"
                            />
                            <Area
                                type="monotone"
                                dataKey="balance"
                                stroke="rgb(var(--primary))"
                                strokeWidth={2.5}
                                fill="url(#balance)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    {(results ?? []).map((metric) => (
                        <div key={metric.label} className="flex flex-col gap-0.5">
                            <span className="text-xs text-muted-foreground">{metric.label}</span>
                            <span
                                className={cn(
                                    "figure text-xl font-bold",
                                    metric.accent === "green" && "text-positive",
                                    metric.accent === "blue" && "text-primary",
                                    metric.accent === "purple" && "text-accent-purple",
                                    metric.accent === "orange" && "text-accent-orange",
                                    metric.accent === "red" && "text-negative"
                                )}
                            >
                                {metric.value}
                            </span>
                        </div>
                    ))}
                </div>

                <p className="text-xs leading-relaxed text-muted-foreground">
                    An estimate on a steady return, compounded monthly. Real returns vary year to year and
                    can be negative; this is for planning, not a projection of what you will have.
                </p>
            </div>
        </div>
    )
}

function SliderRow({
    label,
    value,
    onChange,
    min,
    max,
    step,
    display,
}: {
    label: string
    value: number
    onChange: (value: number) => void
    min: number
    max: number
    step: number
    display: string
}) {
    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium text-foreground">{label}</span>
                <span className="figure text-sm font-bold text-foreground">{display}</span>
            </div>
            <Slider
                label={label}
                value={value}
                onChange={onChange}
                min={min}
                max={max}
                step={step}
                ariaValueText={display}
            />
        </div>
    )
}

/**
 * The one gate on this page. It collects the minimum a sign-up needs — email,
 * password, and an optional name — or hands off to Google, then sends the
 * visitor to the app with the scenario encoded in the URL so nothing they set
 * up here is lost in the move.
 *
 * The marketing site never creates the account itself: it starts a PKCE
 * request and the app completes it. This form's only job is to collect the
 * details once, so the visitor doesn't type them twice.
 */
function SaveGate({ scenario }: { scenario: Record<string, string | number> }) {
    const [open, setOpen] = useState(false)
    const [email, setEmail] = useState("")
    const [name, setName] = useState("")
    const [working, setWorking] = useState(false)

    async function handoff(event?: FormEvent) {
        event?.preventDefault()
        setWorking(true)
        const url = await beginHandoff({
            path: "/sign-up",
            next: "/calculators/compound-interest",
            payload: { ...scenario, ...(email ? { email } : {}), ...(name ? { name } : {}) },
        })
        window.location.href = url
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="w-full">
                    <Lock className="h-4 w-4" />
                    Save this scenario
                </Button>
            </DialogTrigger>
            <DialogContent
                title="Save your scenario"
                description="Free account. Your numbers come with you — nothing you've set here is lost."
            >
                <form onSubmit={handoff} className="flex flex-col gap-3">
                    <TextField label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" required />
                    <TextField label="Name (optional)" value={name} onChange={setName} autoComplete="name" />
                    <Button type="submit" size="lg" disabled={working || email.trim() === ""}>
                        {working && <Loader2 className="h-4 w-4 animate-spin" />}
                        Continue
                    </Button>
                    <Button type="button" variant="outline" size="lg" onClick={() => void handoff()}>
                        Continue with Google
                    </Button>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                        You&rsquo;ll finish signing up on app.finnacalc.com. Password and provider details are
                        entered there, never here.
                    </p>
                </form>
            </DialogContent>
        </Dialog>
    )
}
