/** V2 positions use decimal strings, unlike the retired holdings endpoint. */
export function positionNumber(value: unknown): number | null {
    if (typeof value === "number") return Number.isFinite(value) ? value : null
    if (typeof value !== "string" || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())) return null
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
}

export function accountPositions(data: any): any[] {
    if (!Array.isArray(data?.results) || !data.results.every((p: any) =>
        p != null && typeof p.instrument?.kind === "string" && positionNumber(p.units) != null)) {
        throw new Error("Brokerage positions are incomplete.")
    }
    return data.results
}

// Contract sizes and bond price conventions differ. Only these documented
// unit-priced kinds can use units * price in the existing portfolio contract.
export function hasUnitPrice(kind: string): boolean {
    return ["stock", "preferred_stock", "adr", "etf", "mutualfund", "cef", "crypto"].includes(kind)
}
