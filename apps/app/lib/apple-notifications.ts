import {
    Environment, NotificationTypeV2, Type, VerificationException, VerificationStatus,
} from "@apple/app-store-server-library"
import { APPLE_BUNDLE_ID, AppleSubscriptionError, appleDataVerifier, type AppleGrant } from "./apple-subscriptions"

const handled = new Set<string>([
    NotificationTypeV2.SUBSCRIBED, NotificationTypeV2.DID_RENEW,
    NotificationTypeV2.DID_CHANGE_RENEWAL_PREF, NotificationTypeV2.DID_CHANGE_RENEWAL_STATUS,
    NotificationTypeV2.DID_FAIL_TO_RENEW, NotificationTypeV2.EXPIRED,
    NotificationTypeV2.GRACE_PERIOD_EXPIRED, NotificationTypeV2.REFUND,
    NotificationTypeV2.REFUND_REVERSED, NotificationTypeV2.REVOKE,
    NotificationTypeV2.OFFER_REDEEMED, NotificationTypeV2.RENEWAL_EXTENDED,
])
const productIDs = new Set(["plus", "trader", "pro"].flatMap((tier) =>
    ["monthly", "annual"].map((interval) => `com.finnacalc.${tier}.${interval}`)))

/** Verify both Apple signatures before an original transaction ID reaches storage.
 * The historical status, expiry and appAccountToken never authorize a grant.
 */
export async function verifyAppleNotification(signedPayload: unknown): Promise<Pick<AppleGrant, "originalTransactionId" | "environment"> | null> {
    if (typeof signedPayload !== "string" || !signedPayload || signedPayload.length > 100_000) {
        throw new AppleSubscriptionError("Invalid App Store notification.", 400)
    }
    const environments: AppleGrant["environment"][] = [Environment.PRODUCTION]
    if (process.env.APP_STORE_ALLOW_SANDBOX === "true") environments.push(Environment.SANDBOX)
    let retryable = false
    for (const environment of environments) {
        try {
            const verifier = appleDataVerifier(environment)
            const notification = await verifier.verifyAndDecodeNotification(signedPayload)
            // The official verifier also validates the app identifier and
            // environment for data/summary/appData notification variants.
            if (!handled.has(notification.notificationType ?? "")) return null
            const data = notification.data
            if (!data?.signedTransactionInfo) return null
            if (data.bundleId !== APPLE_BUNDLE_ID || data.environment !== environment
                || (environment === Environment.PRODUCTION && data.appAppleId !== 6787539598)) {
                throw new AppleSubscriptionError("Notification does not match this app.", 400)
            }
            const transaction = await verifier.verifyAndDecodeTransaction(data.signedTransactionInfo)
            if (transaction.bundleId !== APPLE_BUNDLE_ID || transaction.environment !== environment) {
                throw new AppleSubscriptionError("Notification transaction does not match this app.", 400)
            }
            if (transaction.type !== Type.AUTO_RENEWABLE_SUBSCRIPTION || !productIDs.has(transaction.productId ?? "")) return null
            if (!transaction.originalTransactionId) throw new AppleSubscriptionError("Missing notification transaction.", 400)
            return { originalTransactionId: transaction.originalTransactionId, environment }
        } catch (error) {
            if (error instanceof AppleSubscriptionError && error.status >= 500) throw error
            if (error instanceof VerificationException && error.status === VerificationStatus.RETRYABLE_VERIFICATION_FAILURE) retryable = true
        }
    }
    throw new AppleSubscriptionError(retryable ? "App Store verification is temporarily unavailable." : "Invalid App Store notification signature or app.", retryable ? 503 : 400)
}
