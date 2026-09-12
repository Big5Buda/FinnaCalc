# SnapTrade key ownership and production cutover

SnapTrade registers each user under a Client ID. Creating a production key does
not migrate users, connections, orders or permissions from a test key. Sandbox
connections are unavailable on production keys. Sources:
[user registration](https://docs.snaptrade.com/reference/Authentication/Authentication_registerSnapTradeUser),
[terminology](https://docs.snaptrade.com/docs/terminology#snaptrade-user),
[Sandbox](https://docs.snaptrade.com/docs/sandbox).

The approved September 12 inventory is three existing `snaptrade_users` rows,
owned by `FINNACALC-TEST-PKUEY`. The newly created production Client ID is
`FINNACALC-DRGER`. These IDs are public identifiers, not consumer secrets.

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
2. Apply `apps/app/supabase/snaptrade_key_ownership.sql` to the correct Supabase
   project as postgres, before deploying this code. The additive `client_id`
   column backfills nulls with the explicitly identified test Client ID. Its
   legacy default lets old deployed writers create test sessions safely during
   overlap. No row or credential is removed and RLS remains enabled.
3. Verify counts only: `select client_id, count(*) from public.snaptrade_users
   group by client_id;` Expect the existing three rows under the test ID unless
   an independently verified user operation has changed the count. Verify both
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
