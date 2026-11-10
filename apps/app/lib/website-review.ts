/** Temporary public website presentation; existing account features stay in code. */
export const websiteReview = {
    showAccountNavigation: false,
    showInvestingLessons: false,
    showBondsNavigation: false,
    useTradingView: true,
    manualPortfolio: true,
}

const investingNavigation = [
    { href: "/investing/portfolio", label: "Portfolio", account: true },
    { href: "/investing/watchlist", label: "Watchlist", account: true },
    { href: "/investing/goals", label: "Goals", account: true },
    { href: "/investing/tracker", label: "Trade Tracker" },
    { href: "/investing/screener", label: "Screener" },
    { href: "/investing/etfs", label: "ETFs & index funds" },
    { href: "/investing/cash-options", label: "Where cash sits" },
    { href: "/investing/bonds", label: "Bonds", bonds: true },
]

export const visibleInvestingNavigation = investingNavigation.filter(item =>
    (!item.account || websiteReview.showAccountNavigation || (websiteReview.manualPortfolio && item.href !== "/investing/goals")) &&
    (!item.bonds || websiteReview.showBondsNavigation))
