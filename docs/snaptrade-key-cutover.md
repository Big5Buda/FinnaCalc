# SnapTrade key ownership and production cutover

SnapTrade registers each user under a Client ID. Creating a production key does
not migrate users, connections, orders or permissions from a test key. Sandbox
connections are unavailable on production keys. Sources:
[user registration](https://docs.snaptrade.com/reference/Authentication/Authentication_registerSnapTradeUser),
[terminology](https://docs.snaptrade.com/docs/terminology#snaptrade-user),
[Sandbox](https://docs.snaptrade.com/docs/sandbox).

The initial September 12 pre-migration inventory was three `snaptrade_users` rows,
owned by `FINNACALC-TEST-PKUEY`. The newly created production Client ID is
`FINNACALC-DRGER`. These IDs are public identifiers, not consumer secrets.

## September 12 live cutover record

- The approved additive migration preserved all three original rows. Live checks
  found zero missing owners, RLS and the deletion guard enabled, and the
  security-definer deletion RPC executable by service_role only.
- Compatible backend `5ccdc97` was first deployed with the registration flag off.
  The dedicated QA account created one empty Test mapping and a portal session;
  browser authorization was canceled before connecting a brokerage. Vendor logs
  confirmed registration, portal creation and authenticated reads returned 200.
- Production-only `SNAPTRADE_USE_PRODUCTION_KEY=true` was then saved and the same
  revision redeployed. [Activation deployment](https://vercel.com/felipe-project/finnacalc-app/C2yMRtAxckjKwhstHGYE2xTkjriW)
  is Ready with current domain `app.finnacalc.com`.
- The production key's `/brokerages` request returned HTTP 200 at
  **22:07:55 UTC**, matching the public API response of 38 entries and
  `configured: true`. Existing QA Test-key `/accounts` and `/authorizations`
  reads still returned 200 at **22:09:06/22:09:13 UTC** after activation.
- The production listener is `https://app.finnacalc.com/api/snaptrade/webhook`;
  its `TEST_WEBHOOK` delivery returned 200 at **22:08:19 UTC**. The legacy listener
  remains `https://www.finnacalc.com/api/snaptrade/webhook`; its test delivery
  returned 200 at **22:09:54 UTC**. No Trade Detection subscription was created.
- Final database counts: **4 legacy-owned mappings** (the original three plus
  the empty QA mapping), **0 production mappings**, **0 missing owners**.
  No production user, brokerage authorization or trade was created. Real
  production connection, repair, trading and deletion lifecycle tests remain
  unverified; catalog and test-webhook success do not establish those flows.

## Routing and preservation

- `SNAPTRADE_CLIENT_ID` / `SNAPTRADE_CONSUMER_KEY`: existing test key, retained
  unchanged in Vercel. Its sensitive values do not need to be revealed or copied.
- `SNAPTRADE_NEXT_CLIENT_ID` / `SNAPTRADE_NEXT_CONSUMER_KEY`: approved new
  production pair, stored as sensitive server-only **Production** variables.
- `SNAPTRADE_USE_PRODUCTION_KEY`: only the exact string `true` selects the NEXT
  pair for **new registrations**. Absent, `false`, or malformed values select
  the original pair. Do not set the flag or NEXT secrets in Preview.

Stored owners always resolve their matching complete pair, regardless of the
registration flag. Staging NEXT alone does not register users there. Rolling
back the flag does not disable already-created production users. A selected
registration pair that is incomplete fails without falling back to another key.

All existing users continue using their recorded key, including new connections,
repairs, reads, trading, disconnects and account deletion. Changing the registration
flag affects only new users. Missing/unknown ownership or a missing owning key
fails without replacing the session or deleting credentials. Catalog caches and
webhook verification are separated by key. Signed user events must also match
the stored user's Client ID; unknown/deleted users are acknowledged without action.

This release does not transfer existing users between keys, create a second
mapping for them, migrate local history, change their trading permission or
delete their existing connections. Such a migration needs a separately verified
vendor transfer or an explicit user reconnection flow.

## Expand, deploy, verify, activate

1. Keep the current `SNAPTRADE_CLIENT_ID` / `SNAPTRADE_CONSUMER_KEY` unchanged.
   The approved new pair is stored in `SNAPTRADE_NEXT_*`, **Production only**.
   Leave `SNAPTRADE_USE_PRODUCTION_KEY` absent or `false`. No secret needs to be
   read, copied, renamed or rotated. Do not place secrets in source, command
   lines, logs or this guide.
   **Before applying SQL**, verify the Client ID actually used by the deployed
   backend against the migration's backfill/default `FINNACALC-TEST-PKUEY`.
   Use SnapTrade's existing request logs for an authorized read-only request
   from the live deployment; record only the public Client ID and evidence
   reference, not request signatures, secrets or financial data. A dashboard
   key's existence or its label alone does not prove deployment ownership.
   If the ID differs, the existing rows' owner is uncertain, or the deployed ID
   cannot be verified, stop before SQL or activation and resolve the ownership
   evidence. Do not guess a backfill or relabel existing credentials.
2. Apply `apps/app/supabase/snaptrade_key_ownership.sql` to the correct Supabase
   project as postgres, before deploying this code. The additive `client_id`
   column backfills nulls with the explicitly identified test Client ID. Its
   legacy default lets old deployed writers create test sessions safely during
   overlap. No row or credential is removed and RLS remains enabled.
3. Verify counts only: `select client_id, count(*) from public.snaptrade_users
   group by client_id;` Compare owner counts with the recorded preflight
   inventory, accounting only for independently verified user operations. Verify both
   functions/trigger exist and the delete RPC allows service_role only. Do not
   print `st_user_secret` or invoke deletes as a production verification test.
4. Deploy the key-aware code **while the registration flag remains off**.
   Verify existing users' read-only connection access, request routing and
   signature ownership. Confirm every active production function runs this
   version. No trade is needed to validate the credential cutover.
5. Only after these checks, set `SNAPTRADE_USE_PRODUCTION_KEY=true` in
   **Production only** and deploy this same key-aware version. Both key pairs
   remain unchanged. New users register under production; existing users still
   use their recorded owner. Preview retains original-key behavior.
6. Verify the production key's allowed brokers/features, new-user connection flow
   using an explicitly authorized account, and existing-user read/manage access.
   Retain the test key's webhook configuration; configure production delivery to
   the verified receiver too. The receiver accepts both keys only for their own
   stored users. Sandbox testing continues through the test namespace.

## Webhook delivery limits

Webhooks currently log and acknowledge events; they do not update portfolio or
order state. The handler accepts timestamps within five minutes, while
[SnapTrade's documented retries](https://docs.snaptrade.com/docs/webhooks#handling-undeliverable-webhooks)
begin after thirty minutes. A retry retaining its original timestamp therefore
receives HTTP 400; whether SnapTrade refreshes that timestamp is unverified.
After a delivery failure, inspect delivery logs and verify current brokerage
state through authenticated reads. Do not assume retries recovered the event or
disable signature/ownership checks. This limitation currently affects event
logging, not the source of portfolio or order state.

## Mixed versions and deletion retries

The guard trigger makes user/key/secret ownership immutable. Direct deletion of
any session, including deletion through an `auth.users` cascade, is refused.
After SnapTrade accepts a user-requested deletion (or returns an actual SDK404
from that session's owning key), new code calls the service-only
`delete_snaptrade_session` RPC with the expected app user, Client ID and SnapTrade
user ID. It locks and removes only that exact row; retries for a removed row are
harmless and a replacement mapping cannot be deleted by a stale request.

During the brief expand-before-deploy window, an old version may successfully
revoke a requested connection but fail to delete its row. The user sees a retryable
failure; the key-aware version can safely finish that request. An old version's
wrong-key404 cannot discard a newer production mapping, and an old account delete
cannot cascade away those credentials. Old readers may fail to use production
rows; do not keep obsolete deployments exposed as a supported application.

## Support recovery when an owning key is unavailable

An unavailable owning key deliberately blocks brokerage reads, disconnection
and account deletion while retaining the stored credentials for recovery.
Restore an authorized working credential for the **same recorded Client ID**
in its original or NEXT configuration slot, redeploy compatible code, and retry
the user's requested operation. A new Client ID cannot substitute for the
recorded owner; do not re-register the user or overwrite their mapping.

If that credential cannot be recovered, obtain vendor-verified revocation of
the exact recorded Client ID and SnapTrade user before removing its local row.
For an authorized deletion request, an operator may then use the service-only
`delete_snaptrade_session` RPC with that exact app user ID, Client ID and
SnapTrade user ID, preserving the vendor confirmation as the deletion evidence.
Its ownership check must succeed; a changed mapping requires fresh verification.
Never drop/bypass the guard, directly delete or relabel the row, or treat a
404 from another key as proof of revocation. Until same-owner recovery or
verified revocation is complete, retain the account and its credentials.

## Rollback

Before activation, keep the flag off and redeploy compatible key-aware code.
Keep the additive schema/guards and both key pairs.

After any production sessions exist, rollback must keep key-aware code and both
keys available. To stop new production registrations, set
`SNAPTRADE_USE_PRODUCTION_KEY=false` in Production and redeploy compatible code.
Existing production sessions and signed webhooks still resolve the NEXT pair;
new registrations return to the original test key. Do not revert to
pre-ownership code, overwrite the original variables, relabel/delete rows,
drop guards, or revoke either key while it owns sessions. No contraction step is
part of this change.

## Local evidence

`npm run test --workspace @finnacalc/app -- lib/__tests__/snaptrade-key-ownership.test.ts`
uses the installed SnapTrade SDK with an offline Axios transport. It verifies
old/new routing, registration activation/rollback, missing-key preservation,
exact-owner deletion retries, broker catalog isolation and signed webhook
ownership. No vendor call occurs.

`node apps/app/scripts/check-snaptrade-key-ownership.mjs` executes the actual
migration in isolated embedded PostgreSQL, including three-row backfill,
old/new writers, reapply, guarded cascades, RPC permissions and stale retries.
Its pinned temporary test dependency is removed afterward; no live database is used.
