import { afterEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server"
import { config, middleware } from "../../middleware"

afterEach(() => vi.unstubAllEnvs())

function visit(path: string, cookie?: string) {
    return middleware(new NextRequest(`https://app.finnacalc.com${path}`, {
        headers: cookie ? { cookie } : undefined,
    }))
}

const research = [
    "/investing", "/investing/", "/investing?review=1",
    "/investing/screener", "/investing/etfs", "/investing/cash-options",
    "/investing/bonds", "/investing/tracker", "/investing/tracker/pelosi",
    "/investing/stocks/AAPL", "/investing/stocks/BRK.B", "/investing/sectors/technology",
]
const personal = [
    "/investing/portfolio", "/investing/portfolio/analysis", "/investing/portfolio/",
    "/investing/watchlist", "/investing/goals", "/investing/new-private-page",
    "/investing/stocks/AAPL/orders", "/investing/tracker/pelosi/private", "/investing/portfolio/export.csv",
]

describe("public Investing research", () => {
    it.each([...research, ...personal])("runs the page gate for %s, including dotted symbols", (url) => {
        expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true)
    })

    it.each(["/api/snaptrade/accounts", "/api/snaptrade/trade", "/api/market-overview", "/_next/static/app.js", "/favicon.ico"])("keeps %s outside page middleware", (url) => {
        expect(unstable_doesMiddlewareMatch({ config, url })).toBe(false)
    })
    it.each(research)("allows signed-out visitors to %s", (path) => {
        vi.stubEnv("FINNACALC_REQUIRE_INVESTING_SIGN_IN", "false")
        expect(visit(path).status).toBe(200)
    })

    it("is public when the restoration setting has not been configured", () => {
        vi.stubEnv("FINNACALC_REQUIRE_INVESTING_SIGN_IN", undefined)
        expect(visit("/investing").status).toBe(200)
    })

    it.each(personal)("keeps %s gated with the return destination", (path) => {
        vi.stubEnv("FINNACALC_REQUIRE_INVESTING_SIGN_IN", "false")
        const response = visit(path)
        expect(response.status).toBe(307)
        const destination = new URL(response.headers.get("location")!)
        expect(destination.pathname.replace(/\/$/, "")).toBe("/sign-in")
        expect(destination.searchParams.get("next")).toBe(path)
    })

    it.each(research)("can restore the original sign-in gate for %s", (path) => {
        vi.stubEnv("FINNACALC_REQUIRE_INVESTING_SIGN_IN", "true")
        expect(visit(path).status).toBe(307)
    })

    it.each(["true", "false"])("preserves existing signed-in page behavior with setting %s", (setting) => {
        vi.stubEnv("FINNACALC_REQUIRE_INVESTING_SIGN_IN", setting)
        expect(visit("/investing/portfolio", "fc_session=1").status).toBe(200)
    })

    it.each(["/", "/budgeting", "/education", "/taxes", "/investing-guide"])("leaves %s public", (path) => {
        vi.stubEnv("FINNACALC_REQUIRE_INVESTING_SIGN_IN", "true")
        expect(visit(path).status).toBe(200)
    })
})
