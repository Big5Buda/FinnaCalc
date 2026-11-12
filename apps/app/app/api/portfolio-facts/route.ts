import { NextRequest } from "next/server"
import { factsBatch } from "@/lib/public-market/facts"
import { parseSymbols,badRequest,noStore } from "@/lib/public-market/protocol"
export const dynamic="force-dynamic"
export const maxDuration=60
export async function GET(req:NextRequest) {
    let symbols:string[]
    const mode=req.nextUrl.searchParams.get("mode") ?? "facts"
    try { symbols=parseSymbols(req); if (!["facts","classification"].includes(mode)) throw new Error("Unknown facts mode.") }
    catch(error) { return badRequest(error) }
    return Response.json(await factsBatch(symbols,mode),{headers:noStore})
}
