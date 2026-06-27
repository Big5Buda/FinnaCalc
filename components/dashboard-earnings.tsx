"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CalendarClock } from "lucide-react"
import type { EarningsEvent } from "@/app/api/earnings-calendar/route"

function fmtDate(d: string) {
    try {
        return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
    } catch {
        return d
    }
}

const HOUR_LABEL: Record<string, string> = {
    bmo: "Before open",
    amc: "After close",
    dmh: "Midday",
}

export default function EarningsCalendar() {
    const [events, setEvents] = useState<EarningsEvent[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let active = true
        ;(async () => {
            try {
                const res = await fetch("/api/earnings-calendar")
                const json = await res.json()
                if (!res.ok) throw new Error(json.error || "Failed to load calendar")
                if (active) setEvents(json.events)
            } catch (e: any) {
                if (active) setError(e.message)
            } finally {
                if (active) setLoading(false)
            }
        })()
        return () => {
            active = false
        }
    }, [])

    return (
        <Card className="overflow-hidden">
            <CardHeader className="pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                    <CalendarClock className="h-5 w-5 text-blue-600" />
                    <CardTitle className="text-lg">Upcoming Earnings</CardTitle>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">Next 30 days</p>
            </CardHeader>
            <CardContent className="p-0">
                {loading ? (
                    <div className="p-4 space-y-2">
                        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-9 rounded bg-muted animate-pulse" />)}
                    </div>
                ) : error ? (
                    <p className="p-6 text-sm text-muted-foreground text-center">{error}</p>
                ) : events.length === 0 ? (
                    <p className="p-6 text-sm text-muted-foreground text-center">No earnings scheduled in the next 30 days.</p>
                ) : (
                    <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                        <table className="w-full text-sm">
                            <thead className="text-xs text-muted-foreground border-b border-border bg-muted/30 sticky top-0">
                                <tr>
                                    <th className="px-4 py-2 text-left font-semibold">Date</th>
                                    <th className="px-4 py-2 text-left font-semibold">Ticker</th>
                                    <th className="px-4 py-2 text-left font-semibold">When</th>
                                    <th className="px-4 py-2 text-right font-semibold">EPS est.</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/60">
                                {events.map((e, i) => (
                                    <tr key={`${e.symbol}-${e.date}-${i}`} className="hover:bg-muted/40 transition-colors">
                                        <td className="px-4 py-2.5 whitespace-nowrap">{fmtDate(e.date)}</td>
                                        <td className="px-4 py-2.5 font-bold">{e.symbol}</td>
                                        <td className="px-4 py-2.5 text-muted-foreground">{HOUR_LABEL[e.hour] || "—"}</td>
                                        <td className="px-4 py-2.5 text-right">{e.epsEstimate != null ? `$${e.epsEstimate.toFixed(2)}` : "—"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
