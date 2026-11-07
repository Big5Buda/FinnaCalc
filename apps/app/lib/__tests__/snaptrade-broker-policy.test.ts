import { describe, expect, it } from "vitest"
import { US_EQUITY_SUPPORT, usEquitySupport } from "../snaptrade-broker-policy"

describe("reviewed US equity capability ceilings", () => {
    it("distinguishes unit fractionals from notional dollars", () => {
        expect(usEquitySupport("MOOMOO")).toMatchObject({ fractional: true, dollars: false })
        expect(usEquitySupport("ETRADE")).toMatchObject({ fractional: false, dollars: false })
        expect(usEquitySupport("PUBLIC")).toMatchObject({ dollars: true, gtc: false })
    })
    it("never aliases read-only Schwab or Robinhood to trading", () => {
        for (const slug of ["SCHWAB", "Schwab Trading", "ROBINHOOD", "COINBASE", "TRADING212", "__proto__"])
            expect(usEquitySupport(slug)).toBeNull()
        expect(usEquitySupport("ROBINHOOD-AGENTIC")?.dollars).toBe(true)
    })
    it("binds simulated institutions separately from live accounts", () => {
        expect(Object.keys(US_EQUITY_SUPPORT).filter(s => usEquitySupport(s)?.paper)).toEqual(["ALPACA-PAPER", "TRADESTATION-SIM"])
        expect(usEquitySupport("TRADESTATION")?.paper).toBe(false)
    })
})
