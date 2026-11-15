import { NextRequest } from "next/server"
export const MAX_SYMBOLS = 120
export type Unavailable = { status: "no-data" | "unsupported" | "unavailable" | "partial" | "stale"; reason: string; retryAt?: number }
export function parseSymbols(req: NextRequest): string[] {
    const symbols = [...new Set((req.nextUrl.searchParams.get("symbols") ?? "").split(",").map(s=>s.trim().toUpperCase()).filter(Boolean))].sort()
    if (!symbols.length) throw new Error("symbols is required.")
    if (symbols.length > MAX_SYMBOLS) throw new Error("Too many symbols.")
    if (symbols.some(s=> !/^[A-Z0-9][A-Z0-9./^-]{0,24}$/.test(s) || ["__PROTO__", "CONSTRUCTOR", "PROTOTYPE"].includes(s))) throw new Error("Invalid symbol.")
    return symbols
}
export const noStore = { "Cache-Control": "no-store" }
export function badRequest(error: unknown) { return Response.json({ error: error instanceof Error ? error.message : "Invalid request.", maxSymbols: MAX_SYMBOLS }, { status: 400, headers: noStore }) }
