"use client"

import { cn } from "@/lib/utils"
import { compactMoney } from "@/lib/format"
import { chartColor } from "@/lib/budget/category-style"
import type { CategorySlice } from "@/lib/budget/types"

/**
 * The budget donut and the goal ring — the two marks the app draws with
 * Canvas, here as SVG. Gapped wedges, same palette, same geometry.
 */

export function Donut({
    slices,
    size = 92,
    centerLabel,
    centerTone = "negative",
}: {
    slices: CategorySlice[]
    size?: number
    centerLabel?: string
    centerTone?: "negative" | "positive" | "ink"
}) {
    const stroke = Math.max(5, size * 0.11)
    const radius = (size - stroke) / 2
    const circumference = 2 * Math.PI * radius
    const total = slices.reduce((sum, slice) => sum + slice.value, 0)
    const gapDegrees = slices.length > 1 ? 3 : 0

    let offset = 0
    return (
        <div className="relative shrink-0" style={{ width: size, height: size }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="rgb(var(--secondary))"
                    strokeWidth={stroke}
                />
                {total > 0 &&
                    slices.map((slice, index) => {
                        const fraction = slice.value / total
                        const sweep = fraction * 360
                        if (sweep <= gapDegrees) return null
                        const dash = ((sweep - gapDegrees) / 360) * circumference
                        const rotation = -90 + offset + gapDegrees / 2
                        offset += sweep
                        return (
                            <circle
                                key={slice.name}
                                cx={size / 2}
                                cy={size / 2}
                                r={radius}
                                fill="none"
                                stroke={chartColor(index)}
                                strokeWidth={stroke}
                                strokeDasharray={`${dash} ${circumference - dash}`}
                                transform={`rotate(${rotation} ${size / 2} ${size / 2})`}
                            />
                        )
                    })}
            </svg>
            {centerLabel && (
                <span
                    className={cn(
                        "figure absolute inset-0 flex items-center justify-center text-center text-[15px] leading-none",
                        centerTone === "negative" && "text-negative",
                        centerTone === "positive" && "text-positive",
                        centerTone === "ink" && "text-foreground"
                    )}
                >
                    {centerLabel}
                </span>
            )}
        </div>
    )
}

/**
 * A four-colour donut with no figures in it — purely illustrative. Used for the
 * empty state, so it previews the real donut without ever implying real data.
 */
export function SampleDonut({ size = 92 }: { size?: number }) {
    return (
        <Donut
            size={size}
            slices={[
                { name: "a", value: 0.38 },
                { name: "b", value: 0.27 },
                { name: "c", value: 0.21 },
                { name: "d", value: 0.14 },
            ]}
        />
    )
}

export function GoalRing({
    fraction,
    color,
    size = 46,
    children,
}: {
    fraction: number
    color: string
    size?: number
    children?: React.ReactNode
}) {
    // Stroke scales with the ring so the big one doesn't read as spindly.
    const stroke = Math.max(5, size * 0.11)
    const radius = (size - stroke) / 2
    const circumference = 2 * Math.PI * radius
    const dash = Math.min(Math.max(fraction, 0), 1) * circumference

    return (
        <div className="relative shrink-0" style={{ width: size, height: size }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="rgb(var(--secondary))"
                    strokeWidth={stroke}
                />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={color}
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    strokeDasharray={`${dash} ${circumference - dash}`}
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />
            </svg>
            <span
                className="absolute inset-0 flex items-center justify-center"
                style={{ fontSize: size * 0.4 }}
            >
                {children}
            </span>
        </div>
    )
}

/** The legend beside a donut — every slice, including the "Other" rollup. */
export function DonutLegend({ slices }: { slices: CategorySlice[] }) {
    return (
        <ul className="flex min-w-0 flex-1 flex-col gap-1.5">
            {slices.map((slice, index) => (
                <li key={slice.name} className="flex items-center gap-2">
                    <span
                        className="h-2 w-2 shrink-0 rounded-sm"
                        style={{ backgroundColor: chartColor(index) }}
                    />
                    <span className="truncate text-xs font-semibold text-foreground">{slice.name}</span>
                    <span className="figure ml-auto shrink-0 text-[11px] font-normal text-muted-foreground">
                        {compactMoney(slice.value)}
                    </span>
                </li>
            ))}
        </ul>
    )
}
