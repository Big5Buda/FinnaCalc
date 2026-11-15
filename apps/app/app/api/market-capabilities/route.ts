// Deliberately no provider imports or readiness probes.
export const dynamic = "force-dynamic"
export async function GET() {
    return Response.json({ schemaVersion:1, maxSymbols:120, quotes:true, history:true, facts:true, viewerTTL:60, factsTTL:86400 },
        { headers: { "Cache-Control": "public, max-age=300" } })
}
