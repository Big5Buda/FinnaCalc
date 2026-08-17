# FinnaCalc

Monorepo. Two Next.js apps and one shared package.

```
apps/web        marketing site      finnacalc.com, www.finnacalc.com
apps/app        the application     app.finnacalc.com
packages/shared tokens, formatting, calculator math, plan catalog
```

`docs/deploying.md` covers the deploy topology, the env vars each project needs,
and the cutover order. Read it before touching anything deployment-shaped.

---

## Front-end design system — `apps/web` only

**Scope.** These rules govern `apps/web`, the public marketing site, and nothing
else. `apps/app` and `packages/shared` are deliberately exempt: their tokens and
typefaces mirror the iOS app's `Core/DesignSystem/Theme.swift` so the web app and
the phone app read as one product. Changing them there is a separate decision
about iOS parity, not a styling choice — do not "fix" `apps/app` to match this
section.

### Banned

- **Inter, Roboto, Arial, or a system font stack** (`system-ui`, `-apple-system`,
  `ui-sans-serif` as the visible face). They are the default of everything and
  read as an unfinished template. System fonts may appear only at the tail of a
  fallback chain, never as the intended face.
- **White card grids over purple/blue gradients.** The single most templated
  layout on the web.
- **Hand-rolling a component that `@/components/ui` already provides.** If a
  primitive exists, use it. If it nearly fits, extend it there rather than
  building a parallel one beside it.

### Typography

| Role | Face | Tailwind |
| --- | --- | --- |
| Display, hero headlines | **Fraunces** | `font-display` |
| UI, body, labels, buttons | **Bricolage Grotesque** | `font-sans` |
| Math, KPI figures, data tables | **JetBrains Mono** | `font-mono` / `.figure` |

Every number a reader might compare, scan or check — money, percentages, dates
in tables, calculator output — is set in JetBrains Mono. Prose is never mono.

**Weight contrast is mandatory.** A block that runs entirely at 400–600 reads as
default. Pair `font-extralight` (200) against `font-black` (800): light for
supporting lines and large display text, black for the figure or word carrying
the meaning. Do not solve emphasis with colour alone.

### Colour

Defined as CSS variables in `apps/web/app/globals.css`, consumed through
Tailwind tokens. Never hard-code a hex in a component.

| Token | Hex | Use |
| --- | --- | --- |
| `--canvas` | `#090A0F` | Deep Obsidian. The page. |
| `--surface` | `#1E2230` | Slate Zinc. Cards, elevated panels. |
| `--mint` | `#00FF87` | Electric Mint. Primary metrics, growth, primary CTA. |
| `--vermilion` | `#FF4757` | Vermilion. Negative alerts and errors **only**. |

Vermilion never appears on a CTA, a neutral figure, or anything that isn't
genuinely wrong. Mint carries the number that matters; using it everywhere
makes it carry nothing.

The marketing site is **dark only** — there is no light theme and no theme
switcher. `apps/app` keeps its System/Light/Dark switcher; that is not an
inconsistency to resolve.

Body copy is 16–20px with 1.6–1.8 line height, and every text/background pair
clears **4.5:1**.

### Motion

- **framer-motion** for anything animated in React. No hand-rolled
  IntersectionObserver reveals, no `requestAnimationFrame` counters.
- **One orchestrated page-load reveal** per view — a single stagger that brings
  the page in — rather than a dozen independent micro-interactions firing as the
  reader scrolls past each element.
- Everything respects `prefers-reduced-motion`, rendering the finished state
  immediately. Motion is decoration; nothing may depend on it to become legible.

### Primitives

- **shadcn/ui**, configured by `apps/web/components.json`, living in
  `apps/web/components/ui/`.
- Compose from those primitives. A new one goes in `components/ui/` and follows
  the same pattern (Radix behaviour, local markup, `cva` variants, `cn` merging).
- `lucide-react` for icons.

---

## House rules — everywhere, and they outrank the design system

These have governed every change in this repo. A pretty screen that breaks one
is a defect.

1. **Never display a fabricated figure.** No placeholder prices, no invented
   metrics, no example data presented as the reader's own. A value that isn't
   known renders as an em dash with a reason, never as `0` or a plausible guess.
2. **Never claim a certification, audit or volume the product doesn't have.**
   No SOC 2 badge without a SOC 2 report. State what is verifiably true instead.
3. **Say what isn't known.** When a data source is missing or a section can't be
   computed, the UI says so plainly rather than hiding the gap or filling it.
4. **Money actions are the user's.** Orders execute at the user's brokerage,
   never here; every irreversible action is confirmed with its real consequences
   named.
5. **One source of truth for numbers.** Calculator math, formatting and prices
   live in `packages/shared` — the marketing site and the app must compute and
   format identically.

---

## Working here

- Both apps: `npm run dev` at the root (turbo), or per workspace —
  `apps/web` on `:3000`, `apps/app` on `:3001`.
- `apps/app` carries the tax-engine test suite: `npm test` in that workspace,
  176 tests, keep them green.
- `NEXT_PUBLIC_APP_ORIGIN` is read at **build** time by `apps/web` (the `/api`
  proxy is a rewrite). Changing it without rebuilding does nothing.
- The `/api` proxy on `www` exists because shipped iOS builds call
  `www.finnacalc.com/api/…`. Removing it breaks every installed copy.
