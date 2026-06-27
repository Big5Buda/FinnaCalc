"use client"

import { useState } from "react"
import InvestingOptions from "@/components/investing-options"
import StocksPage from "@/components/stocks-page"
import BondsPage from "@/components/bonds-page"
import SafeInvestmentsPage from "@/components/safe-investments-page"

export default function InvestingPage() {
  const [activeSection, setActiveSection] = useState("");
  const [initialSymbol, setInitialSymbol] = useState<string | undefined>();

  const handleSectionClick = (section: string, symbol?: string) => {
    setInitialSymbol(symbol);
    setActiveSection(section);
  };

  const backToDashboard = () => setActiveSection("");

  const renderContent = () => {
    if (activeSection === "stocks") {
      return <StocksPage onBack={backToDashboard} initialSymbol={initialSymbol} />
    }
    if (activeSection === "bonds") {
      return <BondsPage onBack={backToDashboard} />
    }
    if (activeSection === "safe-investments") {
      return <SafeInvestmentsPage onBack={backToDashboard} />
    }
    // Default: the investing dashboard (Market Overview / Portfolio / Screener)
    return <InvestingOptions onSelect={handleSectionClick} />
  }

  return (
      <div className="min-h-screen bg-muted/40 dark:bg-gray-900">
        <main className="container mx-auto px-4 py-8 max-w-6xl">
          {renderContent()}
        </main>
      </div>
  )
}
