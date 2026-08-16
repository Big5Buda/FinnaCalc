"use client"

import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { fixed } from "@/lib/format"
import type { CandlePoint } from "@/lib/investing/market"

/**
 * The price chart — line or candles, with the range pills and a scrub readout.
 * Ported from Features/Investing/StockLineChart.swift.
 *
 * Colour comes from the previous close where the caller knows it, not from the
 * window's first bar: a stock that opened high and drifted down drew a red line
 * under a green "+0.44% today" header when those two baselines disagreed. Both
 * were right; they measured different things.
 */

export const CHART_RANGES = ["1D", "1W", "1M", "1Y", "ALL"] as const
export type ChartRange = (typeof CHART_RANGES)[number]

export type ChartStyle = "line" | "candles"

export function ChartRangePicker({
    range,
    onChange,
}: {
    range: ChartRange
    onChange: (range: ChartRange) => void
}) {
    return (
        <div role="tablist" aria-label="Chart range" className="flex gap-1 rounded-md bg-muted p-1">
            {CHART_RANGES.map((option) => (
                <button
                    key={option}
                    type="button"
                    role="tab"
                    aria-selected={range === option}
                    onClick={() => onChange(option)}
                    className={cn(
                        "h-8 flex-1 rounded-sm text-xs transition",
                        range === option
                            ? "bg-card font-bold text-foreground shadow-sm"
                            : "font-semibold text-muted-foreground hover:text-foreground"
                    )}
                >
                    {option}
                </button>
            ))}
        </div>
    )
}

export function PriceChart({
    points,
    style = "line",
    previousClose,
    showScales = false,
    onScrub,
    height = 220,
}: {
    points: CandlePoint[]
    style?: ChartStyle
    previousClose?: number | null
    showScales?: boolean
    onScrub?: (point: CandlePoint | null) => void
    height?: number
}) {
    const [hover, setHover] = useState<number | null>(null)

    const geometry = useMemo(() => {
        if (points.length < 2) return null
        const width = 600
        const closes = points.map((point) => point.c)
        const highs = points.map((point) => point.h ?? point.c)
        const lows = points.map((point) => point.l ?? point.c)
        const min = Math.min(...(style === "candles" ? lows : closes))
        const max = Math.max(...(style === "candles" ? highs : closes))
        const span = max - min || 1
        const x = (index: number) => (index / (points.length - 1)) * width
        const y = (value: number) => height - ((value - min) / span) * height
        return { width, min, max, span, x, y }
    }, [points, style, height])

    // The reference the line is coloured against: the previous close when the
    // caller has one, else the window's own first point.
    const baseline = previousClose ?? points[0]?.c ?? 0
    const last = points[points.length - 1]?.c ?? 0
    const isUp = last >= baseline
    const stroke = isUp ? "rgb(var(--positive))" : "rgb(var(--negative))"

    if (!geometry) {
        return (
            <div
                className="flex items-center justify-center rounded-lg border border-border bg-card text-sm text-muted-foreground"
                style={{ height }}
            >
                No chart data for this window.
            </div>
        )
    }

    const { width, min, max, x, y } = geometry
    const linePath = points.map((point, index) => `${index === 0 ? "M" : "L"}${x(index)},${y(point.c)}`).join(" ")
    const areaPath = `${linePath} L${width},${height} L0,${height} Z`

    function handleMove(event: React.MouseEvent<SVGSVGElement>) {
        const rect = event.currentTarget.getBoundingClientRect()
        const ratio = (event.clientX - rect.left) / rect.width
        const index = Math.min(points.length - 1, Math.max(0, Math.round(ratio * (points.length - 1))))
        setHover(index)
        onScrub?.(points[index])
    }

    function handleLeave() {
        setHover(null)
        onScrub?.(null)
    }

    return (
        <div className="flex gap-2">
            <svg
                viewBox={`0 0 ${width} ${height}`}
                preserveAspectRatio="none"
                className="w-full touch-none"
                style={{ height }}
                onMouseMove={handleMove}
                onMouseLeave={handleLeave}
                role="img"
                aria-label="Price chart"
            >
                <defs>
                    <linearGradient id="price-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={stroke} stopOpacity="0.18" />
                        <stop offset="100%" stopColor={stroke} stopOpacity="0" />
                    </linearGradient>
                </defs>

                {previousClose != null && previousClose >= min && previousClose <= max && (
                    <line
                        x1={0}
                        x2={width}
                        y1={y(previousClose)}
                        y2={y(previousClose)}
                        stroke="rgb(var(--border-strong))"
                        strokeWidth={1}
                        strokeDasharray="4 4"
                        vectorEffect="non-scaling-stroke"
                    />
                )}

                {style === "line" ? (
                    <>
                        <path d={areaPath} fill="url(#price-fill)" />
                        <path
                            d={linePath}
                            fill="none"
                            stroke={stroke}
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            vectorEffect="non-scaling-stroke"
                        />
                    </>
                ) : (
                    points.map((point, index) => {
                        const open = point.o ?? point.c
                        const close = point.c
                        const high = point.h ?? Math.max(open, close)
                        const low = point.l ?? Math.min(open, close)
                        const up = close >= open
                        const color = up ? "rgb(var(--positive))" : "rgb(var(--negative))"
                        const bodyTop = y(Math.max(open, close))
                        const bodyHeight = Math.max(1, Math.abs(y(open) - y(close)))
                        const candleWidth = Math.max(1, (width / points.length) * 0.6)
                        return (
                            <g key={index}>
                                <line
                                    x1={x(index)}
                                    x2={x(index)}
                                    y1={y(high)}
                                    y2={y(low)}
                                    stroke={color}
                                    strokeWidth={1}
                                    vectorEffect="non-scaling-stroke"
                                />
                                <rect
                                    x={x(index) - candleWidth / 2}
                                    y={bodyTop}
                                    width={candleWidth}
                                    height={bodyHeight}
                                    fill={color}
                                />
                            </g>
                        )
                    })
                )}

                {hover !== null && (
                    <>
                        <line
                            x1={x(hover)}
                            x2={x(hover)}
                            y1={0}
                            y2={height}
                            stroke="rgb(var(--border-strong))"
                            strokeWidth={1}
                            vectorEffect="non-scaling-stroke"
                        />
                        <circle cx={x(hover)} cy={y(points[hover].c)} r={3} fill={stroke} />
                    </>
                )}
            </svg>

            {showScales && (
                <div
                    className="figure flex w-12 shrink-0 flex-col justify-between py-0.5 text-right text-[10px] font-normal text-muted-foreground"
                    style={{ height }}
                >
                    <span>${fixed(max, 2)}</span>
                    <span>${fixed((max + min) / 2, 2)}</span>
                    <span>${fixed(min, 2)}</span>
                </div>
            )}
        </div>
    )
}
