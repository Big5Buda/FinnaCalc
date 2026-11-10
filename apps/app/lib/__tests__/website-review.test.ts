import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({ usePathname: () => "/investing", useRouter: () => ({ push: vi.fn() }) }))
vi.mock("@/components/providers/appearance-provider", () => ({
    useAppearance: () => ({ appearance: "system", setAppearance: vi.fn() }),
}))
vi.mock("@/components/providers/auth-provider", () => ({
    useAuth: () => { throw new Error("Hidden account menu must not be mounted") },
}))

import { SiteHeader } from "@/components/shell/site-header"
import InvestingPage from "@/app/investing/page"
import EducationPage from "@/app/education/page"
import PortfolioPage from "@/app/investing/portfolio/page"
import PortfolioAnalysisPage from "@/app/investing/portfolio/analysis/page"
import { PublicStockResearch } from "@/components/investing/public-research"
import { ManualPortfolioProvider } from "@/components/providers/manual-portfolio-provider"
import { WatchlistProvider } from "@/components/providers/watchlist-provider"

describe("temporary website presentation", () => {
    it("keeps section navigation and appearance while hiding header sign-in and sign-up", () => {
        const html = renderToStaticMarkup(createElement(SiteHeader))
        expect(html).not.toContain('href="/sign-in"')
        expect(html).not.toContain('href="/sign-up"')
        expect(html).toContain('href="/investing"')
        expect(html).toContain('href="/education"')
        expect(html).toContain('aria-label="Appearance"')
    })

    it("shows manual portfolio and watchlist, hiding Goals, Bonds and Investing lessons", () => {
        const html = renderToStaticMarkup(createElement(InvestingPage))
        for (const path of ["goals", "bonds"])
            expect(html).not.toContain(`href="/investing/${path}"`)
        expect(html).not.toContain("Investing lessons")
        expect(html).not.toContain('href="/education/investing/investing-01"')
        for (const path of ["portfolio", "watchlist", "tracker", "screener", "etfs", "cash-options"])
            expect(html).toContain(`href="/investing/${path}"`)
    })

    it("retains the owned lessons on the Education page", () => {
        const html = renderToStaticMarkup(createElement(EducationPage))
        expect(html).toContain('href="/education/investing/investing-01"')
        expect(html).toContain("What Is Investing?")
    })

    it("mounts manual portfolio and analysis without mounting authenticated brokerage hooks", () => {
        for (const Page of [PortfolioPage, PortfolioAnalysisPage]) {
            const html = renderToStaticMarkup(createElement(ManualPortfolioProvider, null, createElement(Page)))
            expect(html).toContain("saved only in this browser")
            expect(html).not.toContain("Connect a brokerage")
        }
    })
    it("offers manual holding and watchlist actions on stock research, with no buy/sell control", () => {
        const html = renderToStaticMarkup(createElement(ManualPortfolioProvider, null,
            createElement(WatchlistProvider, null, createElement(PublicStockResearch, { symbol: "TSLA" }))))
        expect(html).toContain("Add to portfolio")
        expect(html).toContain("Add to watchlist")
        expect(html).not.toContain('href="/investing/trade/')
    })
})
