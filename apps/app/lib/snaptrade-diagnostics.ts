import { randomUUID } from "node:crypto"

export function connectionFailure(error: any, stage: "session" | "connections" | "portal", route: string) {
    const requestId = randomUUID()
    const rawStatus = error?.status ?? error?.response?.status
    const upstreamStatus = Number.isInteger(rawStatus) && rawStatus >= 400 && rawStatus <= 599 ? rawStatus : null
    // SDK errors include signed URLs, response headers and user secrets.
    // Log no error object/message/body, app/vendor ID or connection URL.
    console.warn("[snaptrade_connection_failed]", { requestId, route, stage, upstreamStatus })
    return Response.json({ code: "brokerage_connection_unavailable", requestId,
        error: "Brokerage access could not be confirmed. Try again shortly; if this continues, contact support with the reference." },
    { status: stage === "session" || upstreamStatus === 429 ? 503 : 502, headers: { "Cache-Control": "private, no-store" } })
}
