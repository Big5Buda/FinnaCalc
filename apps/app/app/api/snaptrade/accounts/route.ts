import { NextRequest, NextResponse } from "next/server"
import { clearLegacySnapTradeCookie, getSnapTrade, isSnapTradeConfigured, snapTradeErrorMessage } from "@/lib/snaptrade"
import { loadSession } from "@/lib/snaptrade-session"
import { brokerageReadScope, wantsCountedScope } from "@/lib/snaptrade-access"
import { verifiedAppUserId } from "@/lib/supabase-auth"
import { instrumentMetadata } from "@/lib/snaptrade-instrument-metadata"
import { accountPositions, hasUnitPrice, positionNumber } from "@/lib/snaptrade-positions"

export interface BrokerageAccount {
    id: string
    name: string
    institution: string
    number: string
    totalValue: number | null
    /**
     * Cash in the account's currency, as the brokerage reports it.
     *
     * Not buying power. SnapTrade carries those separately and they differ on
     * a margin account, so calling this one buying power was wrong wherever
     * it was written down.
     */
    cash: number | null
    currency: string
    /** The connection this account belongs to — maps to a SnapTradeConnection's id. */
    connectionId: string | null
}

export interface BrokeragePosition {
    instrumentKind: string | null
    securityId: string | null
    securityIdSource: string | null
    assetType: string
    accountId: string
    symbol: string
    description: string
    units: number
    price: number | null
    marketValue: number | null
    openPnl: number | null
    /** What the shares cost, per share. SnapTrade's average_purchase_price.
     *  Forwarded because open_pnl is the only basis the app had and plenty of
     *  brokerages never send it: an Alpaca paper account reports market value
     *  and leaves open_pnl null, which left the app unable to show a cost
     *  basis or a gain at all. This field is reported far more widely, and it
     *  is the basis directly rather than a figure the basis is inferred from. */
    averagePurchasePrice: number | null
    currency: string | null
    cashEquivalent: boolean
    valuationSupported: boolean
}

function round2(n: number) {
    return Math.round(n * 100) / 100
}

export async function GET(req: NextRequest) {
    if (!isSnapTradeConfigured) {
        return NextResponse.json({ configured: false, accounts: [], positions: [] })
    }

    // Brokerage data requires a signed-in FinnaCalc user — credentials live
    // server-side keyed to the Supabase user (lib/snaptrade-session.ts).
    const appUserId = await verifiedAppUserId(req)
    if (!appUserId) {
        return NextResponse.json({ error: "Sign in to view your brokerage." }, { status: 401 })
    }
    try {
        const session = await loadSession(appUserId)
        if (!session) {
            const res = NextResponse.json({ configured: true, connected: false, accounts: [], positions: [] })
            clearLegacySnapTradeCookie(res)
            return res
        }
        const scope = await brokerageReadScope(appUserId, session, undefined, wantsCountedScope(req.url))
        if ("denied" in scope) return scope.denied
        // Set only when the plan covers fewer connections than are linked.
        const limitedToConnection = scope.countedConnectionId
        const st = getSnapTrade(session)

        // Both aggregate and per-account holdings endpoints are retired for
        // newer clients (production returned 410). Use accounts, V2 positions
        // and balances independently; never fall back to the retired endpoint.
        const { data: accountData } = await st.accountInformation.listUserAccounts({
            userId: session.userId,
            userSecret: session.userSecret,
        })
        // Over the limit, only the counted connection's accounts are read at
        // all, so no balance or holding from an extra connection is fetched or
        // returned. An account with no connection cannot be attributed, and
        // is left out rather than guessed into the figures.
        const accountList = (Array.isArray(accountData) ? accountData : []).filter((a: any) =>
            !limitedToConnection || a?.brokerage_authorization === limitedToConnection)

        // Keep failure distinct from a genuinely empty holdings list. A
        // partial portfolio would otherwise produce false totals and goals.
        //
        // The balance is asked for in its OWN right rather than read off a
        // combined holdings payload. Positions can have a separate sync state,
        // so an account whose holdings have not synced returns no balances
        // either, and cash fails whenever positions do. That is what left a
        // Schwab account reporting a real total, no cash figure, and a client
        // with no way to fill the row except by subtracting its own
        // quote-priced holdings from the brokerage's own total. Those two
        // numbers are different vintages from different price sources, so the
        // difference is cash plus whatever the market did since the last
        // sync, and it drifted by cents from one refresh to the next.
        //
        // Asking for the balance separately means an account can report its
        // cash even while its holdings are still stale, which is the common
        // case on a plan without real-time data.
        const holdingsByAccount = await Promise.all(
            accountList.map(async (a: any) => {
                const positions = await st.accountInformation
                    .getAllAccountPositions({
                        accountId: a.id,
                        userId: session.userId,
                        userSecret: session.userSecret,
                    })
                    .then(({ data }) => {
                        if (a.sync_status?.holdings?.holdings_unavailable === true) throw new Error("Holdings unavailable")
                        return { positions: accountPositions(data), failed: false }
                    })
                    .catch(() => ({ positions: [], failed: true }))
                const balances = await st.accountInformation
                    .getUserAccountBalance({
                        accountId: a.id,
                        userId: session.userId,
                        userSecret: session.userSecret,
                    })
                    .then(({ data }) => (Array.isArray(data) ? data : []))
                    .catch(() => [])
                return { accountId: a.id ?? "", positions: positions.positions, holdingsFailed: positions.failed, balances }
            })
        )

        const failedHoldings = holdingsByAccount.filter((holding) => holding.holdingsFailed)
        if (failedHoldings.length > 0) {
            const names = failedHoldings.map(({ accountId }) => {
                const account = accountList.find((a: any) => a.id === accountId)
                return account?.name ?? account?.institution_name ?? "an account"
            })
            return NextResponse.json({
                code: "holdings_unavailable",
                error: `Holdings could not be refreshed for ${names.join(", ")}. Your complete portfolio is unavailable. Please try again.`,
            }, { status: 502 })
        }

        // Cash in the account's own currency. A multi-currency account holds
        // several cash balances, so the one matching the account's currency
        // wins; anything else would add pounds to dollars.
        const cashByAccount = new Map<string, number | null>(
            holdingsByAccount.map(({ accountId, balances }) => {
                const accountCurrency = accountList.find((a: any) => a.id === accountId)?.balance?.total
                    ?.currency
                const match = (balances as any[]).find(
                    (b: any) => accountCurrency != null && b?.currency?.code === accountCurrency
                )
                const cash = typeof match?.cash === "number" && Number.isFinite(match.cash) ? match.cash : null
                return [accountId, cash != null ? round2(cash) : null]
            })
        )

        const accounts: BrokerageAccount[] = accountList.map((a: any) => ({
            id: a.id ?? "",
            name: a.name ?? "Account",
            institution: a.institution_name ?? "Brokerage",
            number: a.number ?? "",
            totalValue: typeof a.balance?.total?.amount === "number" && Number.isFinite(a.balance.total.amount) ? round2(a.balance.total.amount) : null,
            cash: cashByAccount.get(a.id ?? "") ?? null,
            currency: a.balance?.total?.currency ?? "",
            connectionId: a.brokerage_authorization ?? null,
        }))

        const positions: BrokeragePosition[] = holdingsByAccount.flatMap(({ accountId, positions: accountPositions }) =>
            (accountPositions ?? []).map((p: any) => {
                const units = positionNumber(p.units)!
                const price = positionNumber(p.price)
                const cashEquivalent = p.cash_equivalent === true || p.instrument.kind === "cash"
                const unitPriced = !cashEquivalent && hasUnitPrice(p.instrument.kind)
                const currency = typeof p.currency === "string" && /^[A-Z]{3}$/.test(p.currency) ? p.currency : null
                const valuationSupported = unitPriced && currency != null
                const basis = valuationSupported ? positionNumber(p.cost_basis) : null
                return {
                    accountId,
                    ...instrumentMetadata(p.instrument),
                    symbol:
                        p.instrument.symbol ??
                        p.instrument.raw_symbol ??
                        p.instrument.description ??
                        "—",
                    description: p.instrument.description ?? "",
                    units,
                    price: price != null ? round2(price) : null,
                    marketValue: valuationSupported && price != null ? round2(units * price) : null,
                    // V2 does not supply open P&L; avoid inventing it from
                    // prices/basis that can have different vintages.
                    openPnl: null,
                    averagePurchasePrice: basis != null ? round2(basis) : null,
                    currency,
                    cashEquivalent,
                    valuationSupported,
                }
            })
        )

        // Shipped clients treat every row as a same-currency equity and can
        // replace a null value with a market quote. Require explicit adoption
        // of the V2 currency/cash/valuation contract before returning rows that
        // those clients would mislabel, double-count or value with a multiplier.
        const acceptsV2 = new URL(req.url).searchParams.get("positions") === "v2"
        if (!acceptsV2 && positions.some(p => p.cashEquivalent || !p.valuationSupported
            || p.currency !== accounts.find(a => a.id === p.accountId)?.currency)) {
            return NextResponse.json({ code: "brokerage_client_update_required",
                error: "Update FinnaCalc to read this account's currencies and holding types accurately. Your brokerage connection is preserved." }, { status: 409 })
        }

        const currencies = new Set(accounts.map((a) => a.currency))
        const currency = currencies.size === 1 && accounts[0]?.currency ? accounts[0].currency : null
        const totalValue = currency && accounts.every((a) => a.totalValue != null && Number.isFinite(a.totalValue))
            ? round2(accounts.reduce((sum, a) => sum + a.totalValue!, 0))
            : null

        const res = NextResponse.json({
            configured: true,
            connected: accounts.length > 0,
            accounts,
            positions,
            totalValue,
            currency,
            ...(limitedToConnection ? { limitedToConnection } : {}),
        })
        clearLegacySnapTradeCookie(res)
        return res
    } catch (err: any) {
        const res = NextResponse.json(
            { configured: true, connected: false, accounts: [], positions: [], error: snapTradeErrorMessage(err, "Failed to load brokerage accounts.") },
            { status: 500 }
        )
        clearLegacySnapTradeCookie(res)
        return res
    }
}
