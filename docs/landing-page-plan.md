# FinnaCalc Marketing Landing Page — Plan

> Status: **PLAN ONLY — nothing implemented.** Defines what to build for the pre-launch marketing site.
> Grounded in (a) a teardown of 9 finance-app landing pages (§9) and (b) the **real iOS app**
> (`dreamingofu/FinnaCalcIOS`), whose design system, screens, copy, and brand assets are documented in §0.

---

## 0. Ground truth from the iOS app (`FinnaCalcIOS`)

The web page must mirror the actual app, not a guess. Source of truth: the iOS repo (cloned + read).

### Product = 5 pillars (bottom-nav) + an AI assistant
| Pillar | App's own subhead (verbatim — lift for copy) | Backing (kept web API) |
|--------|----------------------------------------------|------------------------|
| **Home / Calculators** | "Free, accurate financial calculators." | client-side; tax-engine core |
| **Budgeting** | budget builder + AI budget advisor | `api/budget-advisor` |
| **Investing** | "Live markets, your portfolio, and stock research in one place." (Discover / Portfolio / Screener, live quotes, trade via SnapTrade, news) | `api/{snaptrade,screener,stock,candles,market-*,news,top-movers}` |
| **Taxes** | "Answer simple questions and watch your refund update in real time. No forms, no jargon." | tax-engine + `api/efile` |
| **Education** | financial education hub | `api/*` content |
| **AI: Finnabot** | in-app chat assistant (blue FAB on every screen) | `api/chat` |

Calculators seen on Home: Emergency Fund, Break-Even Point, Startup Cost, Cash Flow, Loan, Pricing, ROI
(+ Profit Margin, Employee/Contractor from the web codebase). File-count weight: **Taxes (37) > Investing (19)
> Calculators (15) > Budgeting (8)** — Taxes and Investing are the depth features.

### Copy bank (lift the app's own voice — it's already good)
- Taxes: **"IRS-accurate engine — the real 1040 math"**, **"Live refund tracker as you answer"**,
  **"Saves automatically. Sensitive info never leaves your device unencrypted"**, CTA **"Start Filing"**.
- Taxes header: "File your federal taxes or explore tools to optimize your strategy."
- Investing: "The most-traded stocks on the market right now." (live tickers, mono % figures, green/red).
- Home tagline: "Free, accurate financial calculators."

### Design system (from `Core/DesignSystem/Theme.swift` — authoritative)
- **Dark-first.** Default surface: ink `#020817` page, slate-900 `#0f172a` cards, slate-800 borders.
  Light values exist too (white page, slate-50 text) — it's a dual-theme token set.
- **Brand blue:** `#2563eb` (light) / `#3b82f6` (dark). Hover `#1d4ed8`, press `#1e40af`.
- **Semantic palette (hex):** text-body slate-700/300, text-muted slate-500/400, positive green
  `#16a34a`/`#4ade80`, negative red `#dc2626`/`#ef4444`, caution amber `#f59e0b`.
- **Type:** **IBM Plex Sans** (display/body) + **IBM Plex Mono** for *all numbers* — the app's signature is
  "figures are the heroes." Weights: Regular/Medium/SemiBold/Bold (fonts bundled in the iOS `App/Fonts`).
- **Radii:** 8 (chips) / 10 (buttons, inputs) / 12 (cards) / 16 (large cards) / 20 (hero panels).
- **Type scale:** 12 → 44 (xs…xl5). Low-spread ink-tinted shadows.
- Theme.swift notes the tokens trace to a Claude Design project's `tokens/{colors,typography,radius}.css`
  — **if that CSS exists, reuse it verbatim** for pixel-identical brand on web.

> ⚠️ **Theme mismatch to resolve:** the current `app/layout.tsx` uses **Geist / light**. The app is
> **IBM Plex / dark-first**. The landing page should switch to IBM Plex + dark-first to match the app.
> (This overrides the earlier "keep Geist" note.)

### Brand assets available (in the iOS repo)
- `Logos/finnacalc-logo.png` (hi-res, ~1 MB) — final wordmark **Finna**(ink)+**Calc**(blue).
- `Logos/finnacalc-app-icon-{light,dark}.png` and `App/.../AppIcon-1024{,-dark}.png` — app icon.
- **6 real screenshots** in `Screenshots/`: `home`, `budgeting`, `education`, `investing`, `stock-detail`,
  `taxes` — ready for hero + feature phone mockups. **Light-mode** — used as-is (marketing site is light, §13 Q3 resolved).

---

## 1. Strategic frame

FinnaCalc is a **pre-launch iOS app**; the web repo now serves only marketing. The API backend
(`app/api/**`, Supabase, SnapTrade, Plaid, tax-engine core) stays live for the app.

**#1 job of the page = waitlist / email capture, not an App Store download** — nothing to download yet
(Lunch Money's pre-launch model: screenshots + email → "Show HN" → ~1,000 signups).

**Positioning (LOCKED): sell the full suite.** Calm-premium, clarity-led (Copilot mold), naming the
breadth — budgeting + investing + taxes + AI — in the app's honest, jargon-free voice. Headline direction
recommended (final wording to confirm):
- **Primary:** "Your whole financial life, in one app." + subhead "Budgeting, investing, and taxes — with
  an AI that actually helps."
- Alternates: "Money decisions, minus the jargon." · "Budgeting, investing, taxes — one app."

## 2. Page architecture

Single **long-scroll** page (`app/page.tsx`), the universal layout across all peers. Optional thin
`/privacy`, `/terms` for legal + SEO. Section order:

| # | Section | Purpose | Notes |
|---|---------|---------|-------|
| 1 | **Nav** | wordmark + anchors (Features · Privacy · Waitlist) | No Login (nothing to log into). |
| 2 | **Hero** | headline + 1-line subhead + **one** CTA + iPhone mockup (`home.png`) | **light** presentation; IBM Plex. |
| 3 | **Trust/credibility strip** | "coming to iOS" + waitlist counter + founder | pre-launch substitute for ratings |
| 4 | **Feature: Budgeting** | `budgeting.png` + budget builder & AI advisor | **first feature (LOCKED order)** |
| 5 | **Feature: Investing** | `investing.png` + "live markets, portfolio, research in one place" | mono figures, green/red |
| 6 | **Feature: Taxes** | `taxes.png` + lift "real 1040 math / live refund / no jargon" | depth/differentiator |
| 7 | **Feature: Finnabot AI** | mascot + chat visual; "an AI that actually helps" | **differentiator (LOCKED)** — leans on the mascot for personality |
| 8 | **Privacy & security strip** | plain-language trust (§5) | app already says "never leaves device unencrypted" |
| 9 | **Social proof** | waitlist count + beta/founder quotes | honest only |
| 10 | **Pricing pre-announce** | founding-member offer gated behind waitlist | lever, not wall |
| 11 | **Final CTA** | repeat the single waitlist CTA | |
| 12 | **Footer** | links, contact, socials, legal | |

Feature order is **Budgeting → Investing → Taxes → Finnabot AI** (locked). Calculators fold into the hero
(`home.png` is the hero mockup) rather than a standalone section, since the suite story leads.

## 3. Call-to-action strategy
- **One** primary CTA, repeated: **"Join the waitlist"** / **"Get early access."** No "Download"/"Buy" pre-launch.
- Email-only form → confirmation + optional referral share.
- **At launch:** swap to "Download on the App Store" + a **QR code** near the CTA (Rocket Money) so desktop
  visitors bounce to the store. Pre-launch the QR points at the waitlist.

## 4. Social proof — pre-launch, honest
No invented ratings. Use: live **waitlist counter**, founder credibility, beta-tester quotes (named + photo)
once beta exists. Add press/ratings post-launch.

## 5. Trust & security strip
The app already leads on privacy — mirror its language plainly (PocketSmith-style):
- "Bank-level encryption." · "Read-only account access via **Plaid**." (recognizable shortcut; YNAB does it)
- App's own line: **"Sensitive info never leaves your device unencrypted."**
- Business-model-as-trust: **"We make money from a subscription — never from selling your data."**
Keep it short; premium peers (Copilot/Monarch) don't build a fear wall.

## 6. Pricing — LAUNCH WITH NO PRICING (decided)
No pricing section, no founding-member offer at launch. The final CTA sells early access only ("we'll email
you the moment FinnaCalc lands on the App Store"). Revisit a founding-member/pricing lever post-launch once
the free-vs-paid story is set.

## 7. Design system (use the app's — see §0)
- **IBM Plex Sans + IBM Plex Mono** (numbers in mono). Ship the woff2s; do **not** keep Geist.
- **Present the marketing site LIGHT (LOCKED):** white page, ink text, slate surfaces, brand blue `#2563eb`.
  Use the light-mode screenshots as-is. Keep the dark tokens available (dual-theme) but light is the shipped
  look. Note the app itself is dark-first — marketing-light is an intentional divergence.
- Reuse `tokens/{colors,typography,radius}.css` if obtainable for pixel parity.
- Hero/feature visuals: real screenshots in phone mockups. Reuse `Logos/finnacalc-logo.png` + app icon.
- **Rebuild only the minimal UI primitives the page needs** (Button, Card) — do not restore the deleted kit.
- The app's `FCButton/FCCard/FCStat/FCBadge` are the visual reference for those primitives.

## 8. Waitlist backend — reuse existing infra
Kept `lib/supabase.ts` + `lib/supabase-auth.ts` + an `account` route. Add:
- Supabase table `waitlist` (email, created_at, referral_source, referral_code?).
- `app/api/waitlist/route.ts` — POST insert (validate + dedupe + rate-limit) + GET count (live counter).
- Confirm `middleware.ts` matcher doesn't block it.
This one route is the only new backend the site needs; alternative is a hosted form, but Supabase keeps data
first-party and matches the "we own your data" posture.

## 9. Teardown patterns (ranked) — what the plan rests on
Tier-1 (7–10/10, non-negotiable): single-page long-scroll alternating benefit sections; short benefit-led
hero (3–6 word headline + 1-line subhead); one dominant repeated CTA; product-screenshot hero; social proof
high on the page; business-model-as-trust. Tier-2 (4–6/10): free-trial/offer framing; acquisition discount;
big round user-count; named testimonials with outcomes; couples angle; Product Hunt + Hacker News launch.
Tier-3 differentiators (pick ≤1): Apple awards (Copilot); personality (Cleo); regulatory hook (Origin);
local-first/own-your-data; "we're not going anywhere." **Sources:** live pages (Copilot, Monarch, YNAB, Rocket,
Origin, Actual, PocketSmith) fetched Jul 2026; Cleo/Lunch Money via case study + founder interviews;
growth/funding via CNBC, TechCrunch, Sacra, Failory, Indie Hackers.

## 10. Launch channels (prep during build, fire at ship)
Product Hunt (Copilot launched 3×), "Show HN" (Lunch Money → #1 → ~1k signups), build-in-public/founder
blogging. Bake a short app demo GIF/video (from the real screens) into the page for reuse across all three.

## 11. Implementation phases (later pass — not started)
- **Phase 0 — Content & decisions:** DONE except final headline wording + founding offer. Features locked:
  **Budgeting → Investing → Taxes → Finnabot AI**. Presentation: **light**. Sell the **full suite**.
- **Phase 1 — Assets in:** copy `finnacalc-logo.png`, app icon, and the 6 screenshots into `public/`;
  add IBM Plex woff2 + wire fonts in `layout.tsx`; port the color tokens to `globals.css`.
- **Phase 2 — Waitlist backend:** Supabase `waitlist` table + `app/api/waitlist` route.
- **Phase 3 — Page build:** `layout.tsx` shell (nav/footer, IBM Plex, dark-first) + `page.tsx` sections 1–11,
  responsive, phone mockups.
- **Phase 4 — Polish & instrument:** SEO/OG (use the logo), Vercel Analytics events on CTA, a11y, Lighthouse.
- **Phase 5 — Launch prep:** QR + App-Store-CTA behind a flag; Product Hunt / Show HN assets.

## 12. Scope boundaries
- Do **not** restore deleted app pages, calculators, dashboards, or the full shadcn kit.
- Do **not** touch API backend / tax-engine core beyond adding the `waitlist` route.
- Front-end = single marketing page + minimal legal sub-pages.

## 13. Decisions
1. ✅ **Headline / tone** — sell the **full suite**. Final wording per §1 recommendation (confirm exact copy).
2. ✅ **Feature order** — **Budgeting → Investing → Taxes** (+ Finnabot AI section).
3. ✅ **Screenshots** — present the marketing site **light**; use the light screenshots as-is.
4. ✅ **Pricing** — **launch with no pricing.** No offer/section at launch; revisit post-launch. (This is a
   placeholder page — content will change.)
5. ✅ **Waitlist storage** — **Supabase**.
6. ✅ **Finnabot** — feature the AI assistant as a **differentiator**; use the **mascot** for personality.
7. ⬜ **`tokens/*.css`** — optional. Have the hex tokens from `Theme.swift`; sharing the CSS just guarantees
   pixel parity. Non-blocking.
