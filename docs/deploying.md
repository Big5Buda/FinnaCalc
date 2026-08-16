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
```

**marketing**:

```
NEXT_PUBLIC_APP_ORIGIN=https://app.finnacalc.com
NEXT_PUBLIC_SITE_ORIGIN=https://www.finnacalc.com
```

`NEXT_PUBLIC_APP_ORIGIN` must be present in the **build** environment: the
`/api` proxy in `apps/web/next.config.mjs` is a rewrite, and rewrites are
resolved when the site is built, not per request. Change it and redeploy, or
nothing happens.

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
- `www.finnacalc.com/budgeting` → 307 to the app
- `www.finnacalc.com/api/market-stats?symbols=SPY` returns JSON — **this is
  what keeps installed iOS builds working**
- `app.finnacalc.com/sign-in` completes a real sign-in
- Stripe test checkout completes and the webhook logs a 200
- `/api/chat` streams, and a SnapTrade connection sets its session cookie
  through the proxy (neither could be tested without keys)

## Data left on the old origin

Budgets, goals and watchlists were saved in `localStorage` on
`www.finnacalc.com`; `app.finnacalc.com` is a different origin and starts
empty. The marketing site detects anything stranded there and offers to hand it
over to `app.finnacalc.com/migrate`; the old copy is cleared only after the new
one is written. See `packages/shared/src/storage.ts`.
