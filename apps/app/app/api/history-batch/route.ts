import { NextRequest } from "next/server"
import { historyBatch } from "@/lib/public-market/history"
import { parseSymbols, badRequest, noStore } from "@/lib/public-market/protocol"
export const dynamic = "force-dynamic"
export const maxDuration = 60
export async function GET(req:NextRequest) {
    let symbols: string[]
    try { symbols = parseSymbols(req) } catch (error) { return badRequest(error) }
    const p = req.nextUrl.searchParams
    return Response.json(await historyBatch(symbols,p.get("range") ?? "1M",p.get("interval"),p.get("adjustment") === "all" ? "all" : "split"), { headers: noStore })
}
