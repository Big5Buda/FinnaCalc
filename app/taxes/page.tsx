"use client"

import { useState } from "react"
import { FileText, Calculator } from "lucide-react"
import TaxFilingInterface from "@/components/tax-filing-interface"
import TaxCalculators from "@/components/tax-calculators"

type Tab = "estimator" | "calculators"

export default function TaxesPage() {
    const [tab, setTab] = useState<Tab>("estimator")

    const TABS = [
        { key: "estimator" as const, label: "Tax Estimator", icon: <FileText className="h-4 w-4" /> },
        { key: "calculators" as const, label: "Calculators & Tools", icon: <Calculator className="h-4 w-4" /> },
    ]

    return (
        <div className="min-h-screen bg-muted/40">
            <main className="container mx-auto px-4 py-8 max-w-6xl space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Taxes</h1>
                    <p className="text-sm text-muted-foreground">
                        Estimate your federal taxes and explore tools to optimize your strategy.
                    </p>
                </div>

                <div className="flex gap-1 border-b border-border">
                    {TABS.map((t) => (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                                tab === t.key
                                    ? "border-blue-600 text-blue-600"
                                    : "border-transparent text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            {t.icon}
                            {t.label}
                        </button>
                    ))}
                </div>

                {tab === "estimator" && <TaxFilingInterface />}
                {tab === "calculators" && <TaxCalculators />}
            </main>
        </div>
    )
}
