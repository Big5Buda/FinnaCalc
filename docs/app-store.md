# App Store subscription server activation

FinnaCalc verifies StoreKit purchase signatures with Apple's official `@apple/app-store-server-library`, then asks the App Store Server API for current subscription status. A valid historical receipt alone never activates paid access. The trusted bundle is `com.finnacalc.FinnaCalcIOS`; the owner-confirmed numeric App Store ID is `6787539598`.

## Release handoff — September 10, 2026

The owner paused App Store submission work and requested that completed code changes be merged to GitHub. No App Store upload or submission was performed. Production Supabase now has the Apple ownership, two-bank limit, and 30-day transcript retention migrations. Verification confirmed Apple table RLS and service-role-only access to all three functions. The named hourly retention job completed automatically with status `succeeded` at 04:00 UTC on September 10; an earlier manual invocation removed zero expired rows.

The three Apple purchase credentials are stored as Secret variables for Production only in Vercel project `finnacalc-app`, with `APP_STORE_ALLOW_SANDBOX=true`. Preview does not receive those credentials. Temporary key files were removed after successful import and key validation. Deployment checks and real Apple purchase/status/notification testing remain required; saved configuration is not evidence that those flows have passed.

The native app's separate readiness document tracks remaining submission requirements, including the invalid privacy-purpose value in Plaid's SDK and the authorized [vendor report](https://github.com/plaid/plaid-link-ios/issues/87). Successful local signing/export does not resolve that SDK defect. Resume App Store work only when the owner requests it.

## Required deployment configuration

1. Run `apps/app/supabase/apple_subscription_entitlements.sql` in the same Supabase project used by authentication. The table has RLS and no client policies. Only `service_role` can execute its atomic synchronization function. The production installation is recorded above; other environments require their own setup.
2. Configure `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` on the app backend.
3. In App Store Connect, create an **In-App Purchase** key under Users and Access → Integrations. Configure its issuer ID as `APP_STORE_ISSUER_ID`, key ID as `APP_STORE_KEY_ID`, and the downloaded `.p8` contents as `APP_STORE_PRIVATE_KEY` in the deployment's secret manager. Never put the private key in source control or client builds. Real newlines and escaped `\n` are accepted.
4. `APP_STORE_APPLE_ID` may be omitted, using `6787539598`. Any different value fails configuration validation.
5. Set `APP_STORE_ALLOW_SANDBOX=true` when reviewing Sandbox/TestFlight/App Review purchases. Sandbox acceptance is otherwise off. Sandbox and Production ownership records have separate namespaces. Never accept Xcode local StoreKit proofs on the server.
6. Deploy the backend and native app together only after the SQL/configuration exists. Missing verification configuration produces explicit errors and paid server access remains locked.

The Apple root certificates are public trust anchors embedded in `apps/app/lib/apple-root-certificates.ts`. Their download URLs and SHA-256 hashes are recorded beside the bytes. No private certificates or secrets are embedded.

## Account ownership and native contract

`POST /api/subscriptions/apple/sync`, authenticated with the user's Supabase Bearer token:

```json
{"transactions":["StoreKit signed transaction JWS"],"claimLegacyPurchases":false}
```

The native client sends verified `Transaction.currentEntitlements` proofs. New purchases must carry the signed-in Supabase UUID as StoreKit's `appAccountToken`. Both its signed token and the database ownership record must match the signed-in account. Each `(environment, originalTransactionId)` has one FinnaCalc owner. Database uniqueness and a transaction arbitrate simultaneous claims.

Legacy purchases without an `appAccountToken` require an explicit user confirmation before their first association. The first request returns `409` with `code: legacy_claim_required`; after explaining that the subscription becomes linked to this FinnaCalc account, the client retries with `claimLegacyPurchases: true`. A different existing owner returns `409` with `code: purchase_owned_by_another_account`. There is no automatic transfer. Account deletion removes its ownership records with the rest of its account data; Apple purchases carrying that deleted account's token remain bound to that token, and are not silently reassigned to a new account.

An empty device proof list rechecks every subscription already bound to this FinnaCalc account with Apple and preserves those still active. This keeps a paid account usable on another device or Apple Account. Previously inactive bindings are also rechecked for renewal. Only an Apple-confirmed inactive status removes access; absent device receipts do not cancel or refund an App Store subscription. A failed verification or ownership conflict does not partially update grants. `active` and `tier` in the response describe server-confirmed access.

When the device presents a purchase belonging to another FinnaCalc account, that purchase is never claimed or reassigned. If the signed-in account already owns a different subscription that Apple confirms is active, the endpoint returns its valid `active`/`tier` with `purchaseError: {code, message}`. Routine access keeps that existing plan. Explicit purchase, restore and legacy-claim actions must report the issue and must not report successful activation or finish the rejected transaction. With no valid account-owned subscription, the endpoint continues returning HTTP 409. Signature failures and unavailable Apple status remain errors rather than activating cached access.

Only the six products `com.finnacalc.{plus,trader,pro}.{monthly,annual}` are accepted. Latest active Apple status and an unexpired signed transaction are required; revoked, upgraded, unknown-product and wrong-app transactions grant nothing. Apple's billing grace period is honored only when its current status and separately verified renewal information provide a future grace expiry. Current status is rechecked after at most 15 minutes of server-side cached verification, so revocation can take up to that interval to remove already granted API access.

## App Store Server Notifications V2

ASC currently points both Production and Sandbox notifications to `https://finnacalc.com/api/apple/notifications`. The backend now implements `POST /api/apple/notifications` for the standard `{ "signedPayload": "Apple JWS" }` body. The existing marketing `/api/*` rewrite forwards that path to the app backend. After deployment, verify the exact configured host with a real Apple test notification; the direct application URL is `https://app.finnacalc.com/api/apple/notifications` if avoiding a host redirect is necessary. Confirm ASC uses version 2. This handler has not been deployed or tested with Apple's live notification service by the code changes.

The official Apple verifier checks the notification signature, Apple certificate chain/revocation status, bundle, numeric Production app ID and environment. The nested transaction is separately verified before its original transaction ID is used. Sandbox is accepted only with `APP_STORE_ALLOW_SANDBOX=true`, using a separate ownership namespace.

Only existing database ownership can select an account to refresh. A notification cannot claim an unbound purchase or choose a user through an `appAccountToken` or request field. The handler ignores historical notification status and reads current status from Apple before updating existing grants; repeated or older events therefore cannot revive a refunded purchase or remove a later valid renewal. Unknown, test, unrelated-product and unbound-purchase events are acknowledged without granting anything. Notification payloads, account IDs and credentials are not logged or exposed in responses.

Malformed/unverified input returns HTTP 400. Apple verification outages, database errors or failed current-status reads return HTTP 503 so processing can be retried. Successful processing and verified no-op events return HTTP 200. Current-status checks during ordinary account sync/API access remain as a fallback; notification delivery alone is not assumed reliable.

Before submission, use Apple's test-notification request/status tools for both configured environments and exercise a real Sandbox renewal, expiry and refund. Confirm delivery reaches the deployed route with no 404 or authentication redirect and check that an unbound transaction creates no ownership row. No production purchase or refund should be created merely to test this.

References: [Apple notification receipt](https://developer.apple.com/documentation/AppStoreServerNotifications/receiving-app-store-server-notifications), [official notification verifier](https://github.com/apple/app-store-server-library-node/blob/main/jws_verification.ts).

## Paid API enforcement

Server plan checks protect:

- `/api/budget-advisor` with `depth: deep` or `findings`: Budgeting Plus or Pro.
- `/api/plaid/create-link-token`: Budgeting Plus/Pro for transactions or liabilities; Investing Plus/Pro for investments.
- `/api/plaid/transactions`: Budgeting Plus or Pro, including refresh and token exchange.
- `/api/plaid/holdings`: Investing Plus or Pro.

Existing active, unexpired Stripe subscriptions remain valid for their feature. Free `/api/chat` and quick Budget Advisor responses retain their existing access. A client-supplied tier never grants server access. Fresh SnapTrade portal creation allows one free brokerage connection and requires verified Investing Plus/Pro for another. Existing owned reconnects remain available. Portfolio, quote, new-order and refresh requests recheck the current count and reject multiple free connections with an explicit error. Connection management, viewing existing orders and cancellation stay available. No brokerage is automatically deleted or arbitrarily excluded from a reported total.

SnapTrade exposes no atomic maximum-connection parameter on its portal URL. Redirecting immediately after success and checking counts before/after connection prevents extra app access, but concurrently issued portal sessions can still create extra vendor connections and charges. Vendor-enforced session limits or a dedicated connection reservation/reconciliation design are required to guarantee the vendor connection count itself. Free users adding accounts to a healthy existing login may need to disconnect/relink or upgrade because a fresh portal cannot prove the same brokerage credentials will be reused. Existing disabled-connection reauthentication is preserved. See [SnapTrade portal parameters](https://docs.snaptrade.com/reference/Authentication/Authentication_loginSnapTradeUser).

## Validation before release

Mocked tests cover signature rejection, current status/refund behavior, product validity, environment separation, grace expiry, account ownership conflicts, and paid-feature denial. An actual Apple signature-verifier test rejects a fabricated unsigned premium proof. No live paid transaction, App Store API credential, SQL execution, or deployment was exercised by those tests.

Before release, verify a real Sandbox purchase, renew/expire/refund, Restore Purchases, sign-in to a different FinnaCalc account, and explicit legacy ownership association. Confirm a missing or mismatched proof cannot invoke paid Plaid or deep Budget Advisor services. Verify the ownership migration and RLS in the deployed database.

References: [Apple server library](https://github.com/apple/app-store-server-library-node), [Apple PKI](https://www.apple.com/certificateauthority/), [App Store Server API](https://developer.apple.com/documentation/appstoreserverapi).
