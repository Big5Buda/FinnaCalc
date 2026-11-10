# Public Investing research

The owner requested public access while Google OAuth configuration is blocked
by Supabase organization permissions, so visitors including brokerage API
reviewers can inspect the real website without an account.

Discover, stock details, sectors, screener, ETFs, cash options, bonds and the
public trade tracker are available without sign-in. No sample portfolios,
invented market data or brokerage approval claims are added.

The manual portfolio, its limited analysis and the browser-local watchlist are now public when websiteReview.manualPortfolio is enabled. Connected brokerage UI is not mounted in that mode; its APIs remain authenticated. Goals and unknown subroutes retain their page gate.
Unknown future Investing routes remain gated. API authentication, brokerage
ownership, subscriptions, connection consent and order checks are unchanged.
The `fc_session` cookie remains only a page-navigation hint; it does not grant
access to brokerage APIs.

## Restore the original page gate

After the owner asks to restore it, set the Vercel environment variable
`FINNACALC_REQUIRE_INVESTING_SIGN_IN=true` for the relevant environment and
redeploy. This re-enables the existing gate for every `/investing` route.
When absent or `false`, the explicit public research routes remain accessible.
Sign-in pages, provider integration and credentials are preserved throughout.
Google OAuth configuration still needs the Supabase owner's assistance; this
change does not repair it or require new OAuth credentials.

## Checks

`lib/__tests__/investing-page-access.test.ts` exercises signed-out public
routes, private and unknown routes, return destinations, the restoration
setting and the existing session-hint behavior. Existing brokerage server
authorization tests remain part of the full suite.

## Public display provider

The owner later requested official TradingView embeds and a manual portfolio. See docs/web-investing-readiness.md for the display restrictions, browser storage, calculations, preserved brokerage backend and restoration settings.
