import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * The point of lib/sec.ts is telling "there is nothing here" apart from "we
 * couldn't find out", and the second case can't be produced by calling the real
 * SEC — you'd have to get yourself rate-limited on purpose. So fetch is stubbed
 * and every response code the SEC actually returns is checked.
 *
 * Modules are re-imported per test because the SEC_CONTACT warning is
 * deliberately once-per-process.
 */

const ORIGINAL_FETCH = globalThis.fetch

function respond(status: number, body: unknown = {}) {
    return vi.fn().mockResolvedValue({
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
        text: async () => JSON.stringify(body),
        arrayBuffer: async () => new TextEncoder().encode(JSON.stringify(body)).buffer,
    } as unknown as Response)
}

async function freshSec() {
    vi.resetModules()
    return import("@/lib/sec")
}

beforeEach(() => {
    vi.restoreAllMocks()
})

afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH
})

describe("secJson", () => {
    it("returns the body on 200", async () => {
        globalThis.fetch = respond(200, { hello: "world" })
        const { secJson } = await freshSec()
        const result = await secJson<{ hello: string }>("https://data.sec.gov/x.json", 60)
        expect(result).toEqual({ status: "ok", data: { hello: "world" } })
    })

    it("treats 404 as nothing here, not as a failure", async () => {
        globalThis.fetch = respond(404)
        const { secJson } = await freshSec()
        const result = await secJson("https://data.sec.gov/x.json", 60)
        expect(result.status).toBe("no-data")
    })

    it.each([401, 403])("treats %i as unavailable, never as empty", async (code) => {
        globalThis.fetch = respond(code)
        const { secJson } = await freshSec()
        const result = await secJson("https://data.sec.gov/x.json", 60)
        expect(result.status).toBe("unavailable")
        expect(result).toHaveProperty("reason")
    })

    it("names rate limiting on 429", async () => {
        globalThis.fetch = respond(429)
        const { secJson } = await freshSec()
        const result = await secJson("https://data.sec.gov/x.json", 60)
        expect(result.status).toBe("unavailable")
        expect(result.status === "unavailable" && result.reason).toMatch(/rate-limit/i)
    })

    it("treats a server error as unavailable and quotes the code", async () => {
        globalThis.fetch = respond(503)
        const { secJson } = await freshSec()
        const result = await secJson("https://data.sec.gov/x.json", 60)
        expect(result.status === "unavailable" && result.reason).toContain("503")
    })

    it("treats an unreachable host as unavailable", async () => {
        globalThis.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"))
        const { secJson } = await freshSec()
        const result = await secJson("https://data.sec.gov/x.json", 60)
        expect(result.status).toBe("unavailable")
    })

    it("treats a 200 that isn't JSON as unavailable, not as empty", async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => {
                throw new SyntaxError("Unexpected token <")
            },
        } as unknown as Response)
        const { secJson } = await freshSec()
        const result = await secJson("https://data.sec.gov/x.json", 60)
        expect(result.status).toBe("unavailable")
    })

    it("tells the operator about SEC_CONTACT once, and only on a rejection", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
        globalThis.fetch = respond(403)
        const { secJson } = await freshSec()

        await secJson("https://data.sec.gov/a.json", 60)
        await secJson("https://data.sec.gov/b.json", 60)

        expect(warn).toHaveBeenCalledTimes(1)
        expect(warn.mock.calls[0][0]).toContain("SEC_CONTACT")
    })

    it("says nothing about SEC_CONTACT on an ordinary 404", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
        globalThis.fetch = respond(404)
        const { secJson } = await freshSec()
        await secJson("https://data.sec.gov/a.json", 60)
        expect(warn).not.toHaveBeenCalled()
    })

    it("identifies itself to the SEC on every request", async () => {
        const fetchMock = respond(200)
        globalThis.fetch = fetchMock
        const { secJson } = await freshSec()
        await secJson("https://data.sec.gov/x.json", 60)
        const headers = fetchMock.mock.calls[0][1].headers
        expect(headers["User-Agent"]).toBeTruthy()
    })
})

describe("cikFor", () => {
    const TICKERS = {
        "0": { cik_str: 320193, ticker: "AAPL" },
        "1": { cik_str: 1067983, ticker: "BRK-B" },
    }

    it("zero-pads the CIK to ten digits", async () => {
        globalThis.fetch = respond(200, TICKERS)
        const { cikFor } = await freshSec()
        expect(await cikFor("AAPL")).toEqual({ status: "ok", data: "0000320193" })
    })

    it("finds a class share written with a dot", async () => {
        globalThis.fetch = respond(200, TICKERS)
        const { cikFor } = await freshSec()
        // Quote feeds and people write BRK.B; the SEC writes BRK-B.
        expect(await cikFor("BRK.B")).toEqual({ status: "ok", data: "0001067983" })
    })

    it("says a missing ticker is nothing here", async () => {
        globalThis.fetch = respond(200, TICKERS)
        const { cikFor } = await freshSec()
        const result = await cikFor("SPY")
        expect(result.status).toBe("no-data")
    })

    it("does NOT claim a ticker is missing when the map wouldn't load", async () => {
        // The bug this exists for: a refused ticker map used to return null,
        // which read as "this symbol doesn't file with the SEC" for every
        // symbol at once.
        globalThis.fetch = respond(403)
        const { cikFor } = await freshSec()
        const result = await cikFor("AAPL")
        expect(result.status).toBe("unavailable")
    })
})

describe("reportOf", () => {
    it("carries no reason when the read succeeded", async () => {
        const { reportOf } = await freshSec()
        expect(reportOf({ status: "ok", data: 1 })).toEqual({ status: "ok", reason: null })
    })

    it("passes the reason through so the UI can show it", async () => {
        const { reportOf } = await freshSec()
        expect(reportOf({ status: "unavailable", reason: "Nope." })).toEqual({
            status: "unavailable",
            reason: "Nope.",
        })
    })
})
