"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AnalyticsCenter } from "./analytics-center"
import { AuditLedger } from "./audit-ledger"
import { ControlSidebar } from "./control-sidebar"
import { cn } from "@/lib/utils"

/**
 * The three-column shell.
 *
 * Desktop reads left to right as cause to effect: inputs, what they produce,
 * then the working that gets from one to the other. Below lg there isn't room
 * for three columns without shrinking the chart into uselessness, so the same
 * three regions become tabs — the panels don't change, only how many are on
 * screen at once.
 *
 * One set of panels serves both layouts. Radix keeps all three mounted
 * (`forceMount`) and the breakpoint decides whether the inactive ones are
 * hidden: at lg every panel is shown and the tab strip disappears. Rendering a
 * separate desktop copy would double the chart and the table, and duplicate
 * every input id — which would quietly break the labels.
 */

/** Shown when active, or always once there's room for all three. */
const PANEL = "mt-0 block data-[state=inactive]:hidden lg:data-[state=inactive]:block"

export function CalculatorWorkspace() {
    return (
        <Tabs
            defaultValue="dashboard"
            className="flex flex-col gap-4 lg:grid lg:grid-cols-12 lg:gap-6"
        >
            <TabsList className="grid w-full grid-cols-3 lg:hidden">
                <TabsTrigger value="controls">Controls</TabsTrigger>
                <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                <TabsTrigger value="ledger">Ledger</TabsTrigger>
            </TabsList>

            <TabsContent value="controls" forceMount className={cn(PANEL, "lg:col-span-3")}>
                {/* The parameters follow you down a long ledger — the whole
                    point is editing while watching the effect. */}
                <div className="lg:sticky lg:top-6">
                    <ControlSidebar />
                </div>
            </TabsContent>

            <TabsContent value="dashboard" forceMount className={cn(PANEL, "lg:col-span-6")}>
                <AnalyticsCenter />
            </TabsContent>

            <TabsContent value="ledger" forceMount className={cn(PANEL, "lg:col-span-3")}>
                <AuditLedger />
            </TabsContent>
        </Tabs>
    )
}
