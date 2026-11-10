# Website Investing presentation and backend readiness

## Temporary presentation

`apps/app/lib/website-review.ts` preserves the original navigation and provides
restoration settings. `showAccountNavigation=false` hides the header
account menu and authenticated Investing navigation. The separate manualPortfolio setting now exposes a browser-local portfolio, analysis and watchlist without authentication; Goals stays hidden.
`showBondsNavigation=false` hides Bonds while retaining Where cash sits.
`showInvestingLessons=false` hides the Investing lesson section; the Education
library, reading pages and Cloudflare videos remain intact.

To restore header sign-in/account UI, set showAccountNavigation=true and redeploy. To return to the authenticated connected-brokerage portfolio UI, set manualPortfolio=false; the middleware then gates those personal routes. Restore the custom Alpaca research UI only after confirming external-display permission, by setting useTradingView=false. showInvestingLessons/showBondsNavigation can be restored independently when requested. This is separate from the optional Investing-wide page
gate in `docs/public-investing-review.md`. Authentication routes, personal
pages, account code and backend authorization are preserved; hiding a control
does not change account or API access.

## Existing portfolio and trading backend

The implementation already exists; adding a second order pipeline would
duplicate the shared backend used by the native app:

- `/api/snaptrade/accounts`, connections, orders and refresh load the verified
  user's brokerage session and enforce account/connection scope.
- `/api/snaptrade/trading/status` reports provider and integration readiness
  only after authentication.
- `/api/snaptrade/quote`, `/api/snaptrade/trade/impact` and
  `/api/snaptrade/trade/place` use `snaptrade-trading-routes.ts` and the existing
  ownership, eligibility, funding, review-expiration and replay protections.
- Execution requires `SNAPTRADE_TRADING_RELEASE_APPROVED=true`, an approved
  client key and reviewed broker/account capabilities; no broker is enabled
  by default. No release setting or execution permission was changed here.

The public website has a manual holdings editor and no order ticket. Add to portfolio records a total holding snapshot (ticker, shares, average cost and optional entered current price/date), not an order. Analysis uses entered values only; partial coverage does not produce a misleading portfolio total. The watchlist keeps using its existing local storage key. Manual holdings use a separate finnacalc.manual-portfolio.v1 key and have no default sample positions. All values are USD. No brokerage APIs or AI calls are used for these features. Public pages are limited to the exact manual routes; unknown subroutes and Goals retain the page gate.

The old trade URL redirects to
stock research. The previous authenticated brokerage portfolio/analysis components remain preserved behind the manual/public mode branch, and their server APIs still require authentication.
Restoring a website order ticket later still needs its own UI work and tested
broker readiness; existing backend code is not proof of live Schwab approval
or a completed end-to-end Schwab integration. No real orders were used to test.

SnapTrade's Schwab requirements call for the commercial Accounts and Trading
and Market Data products, the SnapTrade callback, and ThinkOrSwim-enabled
accounts for trading. Reference:
https://support.snaptrade.com/Schwab-Trading-942feaa69a1c830fac4401fb22fbbfc3

## Market-data permissions checked November 10, 2026

The shared provider requests `feed=iex` from Alpaca's production data host.
The owner reports a standard account with no confirmed written public-display
permission. Public access, a login requirement, no subscription charge and a
delay label do not themselves establish redistribution rights.

Alpaca's published support article says its API data cannot be redistributed:
https://alpaca.markets/support/redistribute-alpaca-api

Its published Terms separately limit ordinary use to personal/noncommercial
purposes and require 30 days' advance written notice for making a User
Application available to others. These sources do not establish that FinnaCalc
has the required permission; confirm the account's actual agreements with
Alpaca rather than treating an API key or the IEX feed as a license:
https://files.alpaca.markets/disclosures/library/TermsAndConditions.pdf

The owner authorized official TradingView embeds. useTradingView=true mounts their overview, chart, symbol info, profile, fundamentals, news and screener widgets and prevents the website market client from calling shared Alpaca-backed APIs. Existing custom research screens remain in code for a later licensed data setup. TradingView branding and external links remain; symbol availability and delay are disclosed, and no widget prices are extracted or used in portfolio math or orders. FinnaCalc includes the viewed symbol and display settings in widget configuration; it does not include holding quantities, costs or entered portfolio values. The widget Privacy/Terms disclosures were updated on the website only. This does not establish rights for the shared Alpaca/native feed or close its publicly reachable native API endpoints; those existing endpoints were not changed to avoid disrupting installed apps. The owner still needs to resolve that account-level permission separately.

An older Broker API sandbox example permits redistribution in that sandbox;
it does not establish permission for these production Trading API credentials.
This account-level question also applies to the shared native data feed. No
native API or iOS functionality was disabled by this website presentation work.

Official TradingView widgets are a potential display alternative, with their
branding and their own symbol availability/delay rules. They are embedded
displays, not a data API to extract into FinnaCalc's own cards, charts, AI or
order calculations. No switch or licensing agreement is implied by this note:
https://www.tradingview.com/widget/
https://www.tradingview.com/widget-docs/faq/data/

## Verification

Offline model tests cover finite/bounded input, dates, duplicate ticker updates, decimal rounding, complete/partial valuations, zero-price and zero-cost holdings, allocation basis, and malformed saved data. SSR checks verify the public pages never mount brokerage/auth hooks, still expose manual/watchlist actions, hide Bonds/Goals and header sign-in, and retain Education lessons. Market client tests prove no shared market API is requested in embed mode. Local Chrome screenshots show real TradingView overview and AAPL/TSLA charts with delay indicators. Native browser QA saved AAPL10at100/current125 (cost1000,value1250,gain250), added unpriced MSFT5at200 (portfolio value/gain blank, 50/50 cost allocation), and confirmed persistence after reload. iPhone16 emulation393x852 showed responsive chart and manual/watchlist actions; watchlist toggle persisted after reload and its disposable TSLA entry was removed. No real financial transactions were used.

## Discovery and portfolio presentation follow-up

Company-name/ticker search now offers matching links from the editorial stock/ETF catalog. Exact exchange-qualified tickers and unlisted ticker syntax can still open research; this is not a market-wide company search service. Every sector has individual stock choices, separate from its reference ETF chart. Company names and sectors are editorial metadata, with Alphabet/Meta in Communication; unknown holdings remain Unclassified. Funds/ETFs are a separate group, not a look-through sector estimate.

The manual portfolio and analysis both show a holdings table with company names, unrealized dollar gains and percentage gains relative to entered cost. Summary stats, a sector-mix donut, largest holding and top-three concentration use entered values when all positions are priced, otherwise cost basis. Partial pricing never creates an aggregate value or return. Zero cost does not yield an infinite percentage. These are snapshots, not time-weighted, annualized or historical returns.

## Commercial Schwab review expectations

The public site is a product demonstration, not evidence that Schwab connectivity or trading is enabled. Approval cannot be predicted from appearance. SnapTrade documents Schwab read-only approval separately from trading: trading needs the developer's own Schwab commercial Accounts and Trading access, with callback https://connect.snaptrade.com/oauth/callback. Its support guide additionally lists Market Data - Commercial Production. Actual application and market-display rights must match the intended deployment; commercial approval should not be assumed to permit unrestricted public quote redistribution.

For a reviewer, prepare an accurate company/product description, working contact/Terms/Privacy pages, a short walkthrough of the existing authenticated native brokerage flow (including consent, account ownership, order review and disconnect), and a clear account of what runs now versus after approval. These are practical recommendations, not a published Schwab approval checklist. Google login on the website still requires the Supabase owner's provider-setting access; do not present it as working or as a prerequisite already met.

Primary references checked 2026-11-10:
- https://developer.schwab.com/products/trader-api--commercial
- https://developer.schwab.com/user-guides/apis-and-apps/create-an-app
- https://docs.snaptrade.com/docs/broker-access-guide
- https://support.snaptrade.com/Schwab-Trading-942feaa69a1c830fac4401fb22fbbfc3
