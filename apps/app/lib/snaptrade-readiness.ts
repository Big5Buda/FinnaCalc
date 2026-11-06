import { createClient } from "@supabase/supabase-js"
import { getSnapTrade, isTradingKeyApproved } from "./snaptrade"

function reviewedSlugs(): string[] {
    try {
        const rows = JSON.parse(process.env.SNAPTRADE_TRADING_BROKER_CAPABILITIES ?? "{}")
        return Object.keys(rows).filter(slug => {
            const c = rows[slug]
            return /^[A-Z0-9-]+$/.test(slug) && c && Array.isArray(c.orderTypes) && c.orderTypes.length > 0
                && c.orderTypes.every((v: unknown) => v === "Market" || v === "Limit")
                && Array.isArray(c.timeInForce) && c.timeInForce.length > 0
                && c.timeInForce.every((v: unknown) => v === "Day" || v === "GTC")
                && Array.isArray(c.exchanges) && c.exchanges.length > 0
                && c.exchanges.every((v: unknown) => typeof v === "string" && /^[A-Z0-9]{2,12}$/.test(v))
                && typeof c.fractional === "boolean" && typeof c.preview === "boolean"
        })
    } catch { return [] }
}

async function storageReady(): Promise<boolean> {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return false
    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
    // A read-only version RPC is supplied by the separately reviewed trading
    // migration. Missing migration/permissions fail closed; no consume probe.
    const { data, error } = await db.rpc("snaptrade_order_review_storage_version")
    if (error || data !== 3) return false
    const { error: tableError } = await db.from("snaptrade_order_reviews").select("id,impact_facts,generation").limit(0)
    const { error: ownerError } = await db.from("snaptrade_order_review_owners").select("owner_id,generation").limit(0)
    return !tableError && !ownerError
}

/** Safe live metadata. This module has no execution routes or order SDK calls. */
export async function integrationReadiness(clientId: string, artifact = { execution: false, tradeConnections: false }) {
    const { data } = await getSnapTrade({ clientId }).referenceData.getPartnerInfo()
    if (typeof data?.can_access_trades !== "boolean" || !Array.isArray(data.allowed_brokerages))
        throw new Error("Brokerage feature metadata unavailable")
    const available = data.allowed_brokerages.filter(b => typeof b.slug === "string" && /^[A-Z0-9-]+$/.test(b.slug)
        && b.enabled === true && b.maintenance_mode === false)
    const provider = { tradingEnabled: data.can_access_trades,
        connectionBrokerages: [...new Set(available.map(b => b.slug!))].sort(),
        tradingBrokerages: data.can_access_trades ? [...new Set(available.filter(b => b.allows_trading === true).map(b => b.slug!))].sort() : [] }
    const reviewed = reviewedSlugs()
    const supportedBrokerages = provider.tradingBrokerages.filter(slug => reviewed.includes(slug))
    const keyApproved = isTradingKeyApproved(clientId)
    const released = process.env.SNAPTRADE_TRADING_RELEASE_APPROVED === "true" && keyApproved
    // Merely deploying this diagnostic endpoint cannot enable absent routes.
    // The caller's artifact manifest changes only with a reviewed route release.
    const executionReleased = released && artifact.execution
    const enabled = executionReleased && supportedBrokerages.length > 0 && await storageReady()
    const tradeConnectionsEnabled = released && artifact.tradeConnections && supportedBrokerages.length > 0
        && process.env.SNAPTRADE_TRADE_CONNECTIONS_ENABLED === "true"
    const reasonCode = !provider.tradingEnabled ? "provider_trading_not_enabled"
        : !released ? "trading_not_enabled"
        : !supportedBrokerages.length ? "broker_trading_unavailable"
        : !executionReleased ? "execution_routes_unavailable"
        : !enabled ? "order_storage_unavailable" : undefined
    return { enabled, tradeConnectionsEnabled, supportedBrokerages, ...(reasonCode ? { reasonCode } : {}), provider }
}
