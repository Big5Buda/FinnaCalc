# Deploying

Two Vercel projects, one repo.

| Project | Root Directory | Domains |
| --- | --- | --- |
| marketing | `apps/web` | `finnacalc.com`, `www.finnacalc.com` |
| app | `apps/app` | `app.finnacalc.com` |

Both need **Settings → General → Include source files outside of the Root
Directory** switched **on**. Without it the build sees only its own folder, and
`npm install` fails with `E404 @finnacalc/shared` — the workspace package it
depends on lives at the repo root. (Verified: installing with only `apps/app`
present produces exactly that error.)

Neither app sets `installCommand`. Vercel detects npm workspaces from the root
lockfile and installs the whole tree; an override risks running install inside
the app folder, which is the failure above. The old `apps/app/vercel.json`
existed only to force npm over pnpm, which the root `package-lock.json` now
does on its own.

## Environment variables

**app** — everything it already had, plus:

```
NEXT_PUBLIC_SITE_ORIGIN=https://www.finnacalc.com
NEXT_PUBLIC_SESSION_COOKIE_DOMAIN=.finnacalc.com
SEC_CONTACT=FinnaCalc you@finnacalc.com
```

`SEC_CONTACT` is the User-Agent the five SEC-backed routes identify themselves
with — financials, statements, insider trades, fund holdings, congress filings.
The SEC rejects callers it can't reach, and it rate-limits by User-Agent, so a
deployment serving real traffic needs its own rather than the shared fallback in
`lib/sec.ts`. When it's wrong the server logs `[sec] 403 …` once per process and
the affected sections say the filings couldn't be loaded — they no longer render
empty, which used to look like the company files nothing.

**marketing**:

```
NEXT_PUBLIC_APP_ORIGIN=https://app.finnacalc.com
NEXT_PUBLIC_SITE_ORIGIN=https://www.finnacalc.com
```

`NEXT_PUBLIC_APP_ORIGIN` must be present in the **build** environment: the
`/api` proxy and the redirects in `apps/web/next.config.mjs` are both resolved
when the site is built, not per request. Change it and redeploy, or nothing
happens.

## AI transcript retention

Before releasing the 30-day AI transcript policy, apply
`apps/app/supabase/ai_transcript_retention.sql` after `ai_transcripts.sql` and
verify a successful cleanup run. A Vercel deployment does not install the
Supabase Cron job. The [retention deployment and monitoring guide](ai-transcript-retention.md)
covers privileges, the exact cutoff, signed-out records and local SQL validation.

## Bank connection limit

Before deploying bank linking, run `apps/app/supabase/plaid_item_limit.sql` after
the existing `plaid_items.sql` table setup. It atomically caps each account at
two bank logins. Existing links can still refresh; adding a third requires
disconnecting one first.

## The paid extra bank login

Nothing charges for one yet, and nothing here starts charging on its own. The
server side is ready so that the day an add-on product exists, the only work
left is in App Store Connect.

Apply `apps/app/supabase/bank_connection_addon.sql` after
`apple_subscription_entitlements.sql` and `plaid_item_limit.sql`. It widens the
entitlement mirror's `tier` check to accept `bank_addon` and replaces
`save_plaid_item_with_limit` with a version that takes the cap as an argument.
The four-argument version is dropped in the same migration, so deploy the code
and the SQL together: the application passes five arguments.

What is now true without any further code:

- `com.finnacalc.bank.extra.monthly` is accepted by the sync route and by the
  Apple notification handler. Before this, submitting it would have thrown and
  taken the user's plan proofs down with it, since one unrecognised product id
  fails the whole batch.
- An add-on grant is stored beside the plan, not instead of it, and buys no
  feature: everything that reads entitlements matches `plus`, `trader` or
  `pro`, and `bank_addon` is none of them.
- The connection cap is `2 + active add-ons`, resolved per account in
  `lib/bank-allowance.ts` and enforced in all three places that used to
  hardcode two.
- `GET /api/plaid/connections` lists the linked banks with their item ids, so
  the app can disconnect one instead of all of them, and says which of them
  the plan includes.
- The two 409s from the bank routes now carry `code`, so the app can tell the
  cap apart from a connection owned by another account.

In App Store Connect the add-on must be an auto-renewable subscription in
**its own subscription group**. Products in one group are alternatives, so an
add-on sharing the plans' group would arrive as an upgrade and cancel the plan
it was meant to extend.

Cancelling is Apple's, not ours. Disconnecting the extra bank does not stop
the charge; the subscriber cancels the add-on in their App Store subscription
settings, and the app says so rather than implying we can do it for them.

## Native Sign in with Apple account deletion

The **app** server accepts a fresh native Apple authorization code at
`POST /api/account/delete`. It exchanges the code, verifies Apple's signed
identity against the authenticated user's Apple identity, then revokes the
refresh token before removing the account. Configure these server-only values:

- `APPLE_SIGN_IN_CLIENT_ID`: the native app bundle identifier, currently
  `com.finnacalc.FinnaCalcIOS` (must be enabled for Sign in with Apple).
- `APPLE_TEAM_ID`: the Apple Developer team that owns that identifier.
- `APPLE_SIGN_IN_KEY_ID`: a Sign in with Apple key for that team.
- `APPLE_SIGN_IN_PRIVATE_KEY`: that key's `.p8` PEM contents. Literal `\\n`
  escapes are accepted. Never use a `NEXT_PUBLIC_` variable for this key.

The server generates a five-minute ES256 client secret for each request. Codes
and tokens are never logged or retained by this flow. No redirect URI is sent
because native authorization does not use one. The Supabase Apple provider
must also accept the native bundle identifier.

When tokens or server credentials are unavailable, account deletion still
completes and returns `appleRevocation: "manual_required"`; the native app
directs the user to Apple's instructions for removing access. This fallback is
required by [Apple TN3194](https://developer.apple.com/documentation/technotes/tn3194-handling-account-deletions-and-revoking-tokens-for-sign-in-with-apple).
Verify the configured flow with a disposable Apple-linked account before
submission; unit tests cannot validate Apple Developer configuration.

## Redirects off the root domain

Every path that used to be served by `www` and now lives on the subdomain
redirects from `apps/web/next.config.mjs`. Two waves stranded them: the 2024
per-calculator pages (`/loan-calculator` and friends, removed in #52) and every
application route (moved by #99).

Application routes are **308** — they live on the subdomain by design. Company
pages (`/about`, `/plans`, `/privacy`, `/terms`) are **307**, because the
marketing site may reclaim them and a cached 308 is hard to take back. `/advising`
stays a 404: that service doesn't exist, and sending it somewhere plausible
would be worse than the 404.

Next evaluates redirects **before** `beforeFiles` rewrites, so no redirect may
match `/api/*` — it would shadow the proxy below.

## The /api proxy

`www.finnacalc.com/api/*` forwards to the app origin because every installed
iOS build calls `www` (`APIConfig.baseURL` in the iOS repo). Removing the proxy
breaks every shipped copy of the app, and no App Store release fixes the ones
already installed. It stays until those builds are gone.

## Order of operations for the cutover

1. Point the existing project's Root Directory at `apps/app`, enable the
   outside-files toggle, redeploy, confirm green.
2. Create the marketing project on `apps/web` with the same toggle.
3. Set the environment variables above on both.
4. Attach `app.finnacalc.com` to the app project and verify it end to end —
   `www` is still serving the old app, so nothing is down yet.
5. Update the allowlists that validate an origin: Supabase (Site URL +
   redirect URLs), Google OAuth origins, Apple return URL, Stripe webhook
   endpoint, SnapTrade redirect.
6. Remove `finnacalc.com` and `www` from the app project, add them to the
   marketing project, update DNS. This is the cutover; expect a short gap.

Rolling back is step 6 in reverse and takes minutes.

## Verify after cutover

- `www.finnacalc.com` serves the marketing landing, sliders move
- `www.finnacalc.com/budgeting` → 308 to the app
- `www.finnacalc.com/loan-calculator` → 308 to `/calculators/loan`
- `www.finnacalc.com/about` → 307 to the app
- `www.finnacalc.com/api/market-stats?symbols=SPY` returns JSON — **this is
  what keeps installed iOS builds working**
- `app.finnacalc.com/sign-in` completes a real sign-in
- Stripe test checkout completes and the webhook logs a 200
- `/api/chat` streams, and the signed-in SnapTrade connection resolves its
  server-stored session through the proxy (requires configured keys)

## SnapTrade production key cutover

Apply the additive ownership migration before deploying key-aware routes, then
verify with the original registration key before enabling production registration.
The existing sensitive key pair stays in place; an explicit Production flag
selects the staged NEXT pair only for new users. Follow the exact preparation,
verification and rollback sequence in [SnapTrade key cutover](snaptrade-key-cutover.md).

## Data left on the old origin

Budgets, goals and watchlists were saved in `localStorage` on
`www.finnacalc.com`; `app.finnacalc.com` is a different origin and starts
empty. The marketing site detects anything stranded there and offers to hand it
over to `app.finnacalc.com/migrate`; the old copy is cleared only after the new
one is written. See `packages/shared/src/storage.ts`.
