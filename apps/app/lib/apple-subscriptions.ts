import {
    AppStoreServerAPIClient, Environment, SignedDataVerifier, Status, Type,
    type JWSTransactionDecodedPayload,
} from "@apple/app-store-server-library"
import { appleRootCertificates } from "./apple-root-certificates"
import type { PlanTier } from "./stripe"

export const APPLE_BUNDLE_ID = "com.finnacalc.FinnaCalcIOS"
const products = new Map<string, PlanTier>(
    (["plus", "trader", "pro"] as const).flatMap((tier) =>
        ["monthly", "annual"].map((interval) => [`com.finnacalc.${tier}.${interval}`, tier] as const))
)

export class AppleSubscriptionError extends Error {
    constructor(message: string, readonly status: number) { super(message) }
}

export interface AppleGrant {
    productId: string
    tier: PlanTier
    originalTransactionId: string
    transactionId: string
    expiresAt: string
    environment: Environment.PRODUCTION | Environment.SANDBOX
    appAccountToken?: string
}

function configuration() {
    const appAppleId = Number(process.env.APP_STORE_APPLE_ID ?? "6787539598")
    const issuerId = process.env.APP_STORE_ISSUER_ID
    const keyId = process.env.APP_STORE_KEY_ID
    const signingKey = process.env.APP_STORE_PRIVATE_KEY?.replace(/\\n/g, "\n")
    if (appAppleId !== 6787539598 || !issuerId || !keyId || !signingKey) {
        throw new AppleSubscriptionError("App Store subscription verification is not configured. Please contact support.", 503)
    }
    return { appAppleId, issuerId, keyId, signingKey }
}

export function appleDataVerifier(environment: Environment.PRODUCTION | Environment.SANDBOX) {
    const config = configuration()
    return new SignedDataVerifier(appleRootCertificates, true, environment, APPLE_BUNDLE_ID, config.appAppleId)
}

function client(environment: Environment.PRODUCTION | Environment.SANDBOX) {
    const config = configuration()
    return new AppStoreServerAPIClient(config.signingKey, config.keyId, config.issuerId, APPLE_BUNDLE_ID, environment)
}

/** Only an Apple-verified transaction may reach this pure entitlement check. */
export function grantForVerifiedTransaction(transaction: JWSTransactionDecodedPayload, now = Date.now(), verifiedGraceExpiry?: number): AppleGrant | null {
    const tier = products.get(transaction.productId ?? "")
    const accessExpiry = verifiedGraceExpiry ?? transaction.expiresDate
    if (!tier || transaction.bundleId !== APPLE_BUNDLE_ID || transaction.type !== Type.AUTO_RENEWABLE_SUBSCRIPTION
        || !transaction.transactionId || !transaction.originalTransactionId
        || transaction.revocationDate != null || transaction.isUpgraded === true
        || !Number.isFinite(accessExpiry) || accessExpiry! <= now
        || ![Environment.PRODUCTION, Environment.SANDBOX].includes(transaction.environment as Environment)) return null
    return {
        productId: transaction.productId!, tier,
        originalTransactionId: transaction.originalTransactionId, transactionId: transaction.transactionId,
        expiresAt: new Date(accessExpiry!).toISOString(),
        environment: transaction.environment as AppleGrant["environment"],
        ...(transaction.appAccountToken ? { appAccountToken: transaction.appAccountToken } : {}),
    }
}

async function decodeSubmitted(signed: string): Promise<JWSTransactionDecodedPayload> {
    configuration()
    try {
        return await appleDataVerifier(Environment.PRODUCTION).verifyAndDecodeTransaction(signed)
    } catch {
        if (process.env.APP_STORE_ALLOW_SANDBOX === "true") {
            try { return await appleDataVerifier(Environment.SANDBOX).verifyAndDecodeTransaction(signed) } catch { /* reject below */ }
        }
        throw new AppleSubscriptionError("The App Store purchase could not be verified. Restore purchases and try again.", 400)
    }
}

/** Consult Apple now so an old, correctly signed pre-refund receipt cannot grant access. */
export async function currentAppleGrant(originalTransactionId: string, environment: AppleGrant["environment"]): Promise<AppleGrant | null> {
    if (environment === Environment.SANDBOX && process.env.APP_STORE_ALLOW_SANDBOX !== "true") return null
    try {
        const response = await client(environment).getAllSubscriptionStatuses(originalTransactionId)
        if (response.bundleId !== APPLE_BUNDLE_ID || response.environment !== environment) {
            throw new AppleSubscriptionError("The App Store returned an unexpected subscription record.", 502)
        }
        const candidates: AppleGrant[] = []
        for (const group of response.data ?? []) {
            for (const item of group.lastTransactions ?? []) {
                if (item.originalTransactionId !== originalTransactionId
                    || ![Status.ACTIVE, Status.BILLING_GRACE_PERIOD].includes(item.status as Status)
                    || !item.signedTransactionInfo) continue
                const transaction = await appleDataVerifier(environment).verifyAndDecodeTransaction(item.signedTransactionInfo)
                if (transaction.originalTransactionId !== originalTransactionId) continue
                let graceExpiry: number | undefined
                if (item.status === Status.BILLING_GRACE_PERIOD) {
                    if (!item.signedRenewalInfo) continue
                    const renewal = await appleDataVerifier(environment).verifyAndDecodeRenewalInfo(item.signedRenewalInfo)
                    if (renewal.originalTransactionId !== originalTransactionId) continue
                    graceExpiry = renewal.gracePeriodExpiresDate
                    if (!Number.isFinite(graceExpiry) || graceExpiry! <= Date.now()) continue
                }
                const grant = grantForVerifiedTransaction(transaction, Date.now(), graceExpiry)
                if (grant) candidates.push(grant)
            }
        }
        return candidates.sort((a, b) => Date.parse(b.expiresAt) - Date.parse(a.expiresAt))[0] ?? null
    } catch (error) {
        if (error instanceof AppleSubscriptionError) throw error
        throw new AppleSubscriptionError("Current subscription status could not be confirmed with the App Store. Please try again.", 503)
    }
}

export async function verifySubmittedTransactions(transactions: string[]): Promise<AppleGrant[]> {
    if (transactions.length > 10 || transactions.some((signed) => typeof signed !== "string" || signed.length > 30_000 || !signed)) {
        throw new AppleSubscriptionError("Invalid App Store purchase proof.", 400)
    }
    const seen = new Set<string>()
    const grants: AppleGrant[] = []
    for (const signed of transactions) {
        const transaction = await decodeSubmitted(signed)
        if (!transaction.originalTransactionId || !products.has(transaction.productId ?? "")) {
            throw new AppleSubscriptionError("This purchase does not match a FinnaCalc subscription.", 400)
        }
        const environment = transaction.environment as AppleGrant["environment"]
        const key = `${environment}:${transaction.originalTransactionId}`
        if (seen.has(key)) continue
        seen.add(key)
        const grant = await currentAppleGrant(transaction.originalTransactionId, environment)
        if (grant) grants.push(grant)
    }
    return grants
}
