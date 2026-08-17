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

**Scope.** These rules govern **both web workspaces** — `apps/web` (the public
marketing site) and `apps/app` (the signed-in application). One system, so the
walk from finnacalc.com to app.finnacalc.com is continuous.

`apps/app` adopted this system in August 2026 at the user's direction, replacing
the Paper & Cobalt palette that mirrored the iOS app's
`Core/DesignSystem/Theme.swift`. **The iPhone app deliberately keeps its blue
theme** — web and phone now read as siblings, not twins. Do not "fix" the iOS
repo to match this section; that would be a separate decision.

The two workspaces express the same tokens differently by necessity:
`apps/web` declares them in `app/globals.css`, `apps/app` gets them from
`packages/shared/src/tailwind-preset.ts` (its only consumer). The hex values are
the same on both sides — change one, change the other.

**Provenance.** This system was measured off wealthsimple.com in August 2026
(stylesheets, computed styles, full-page renders) and adopted deliberately, at
the user's direction, replacing the earlier Deep Obsidian dark system. The brief
names this direction; it wins outright.

### Banned

- **Inter, Roboto, Arial, or a system font stack** as the visible face. System
  fonts appear only at the tail of a fallback chain.
- **Pure black or pure grey neutrals.** Every neutral here is warm — `#1C1B1B`,
  not `#000`; the page is cream, never white.
- **Fabricated set dressing.** The reference decorates with a fake $308,926.53
  balance; this site never does. A number on the page is computed, counted, or
  absent (see house rules).
- **Hand-rolling a component that `@/components/ui` already provides.**

### Typography

Two faces, two voices. The variables are named by **role** so the planned
licensed faces (Tiempos Text for serif, The Future for sans — purchase pending)
drop in by editing `app/layout.tsx` alone.

| Role | Face today | Tailwind |
| --- | --- | --- |
| Brand moments: hero line, manifesto, footer wordmark | **Source Serif 4** | `font-serif` / `.headline-serif` |
| Everything else, product headlines included | **DM Sans** | `font-sans` / `.headline-sans` |

Measured rules, applied everywhere:

- Line-height **1.16** on all headlines, hero to manifesto.
- Tracking **negative on the serif** (−0.01em), **positive on the sans**
  (+0.005em). Never the other way.
- The serif is weight 400 — size does the work. Sans headlines are 500.
- Serif and sans are never mixed inside one headline.
- Product headlines are full sentences carrying the benefit ("A budget that
  lives on your device, not our servers."), not labels with subtitles.
- Figures use `.figure` (tabular numerals); there is no mono face on this site.

### Colour

Defined as CSS variables in `apps/web/app/globals.css`, consumed through
Tailwind tokens. Never hard-code a hex in a component.

| Token | Hex | Use |
| --- | --- | --- |
| `--paper` | `#F5F3EF` | Cream. The page, and the breath between colour blocks. |
| `--chip` | `#FCFCFC` | The nav pill, cards, phones — anything lifted off a ground. |
| `--ink` | `#1C1B1B` | Text, primary buttons. Warm black, never `#000`. |
| `--ink-soft` / `--ink-muted` | `#494645` / `#686664` | Secondary text, captions. |
| `--line` / `--line-strong` | `#E4E2E1` / `#C9C6C4` | Hairlines. |
| `--sec-budgeting` | `#5F5974` | Budgeting's ground. Muted purple. |
| `--sec-investing` | `#0C330D` | Investing's ground. Near-black green. |
| `--sec-taxes` | `#564C47` | Taxes' ground. Warm brown. |
| `--sec-education` | `#EEE3B1` | Education's inset panel. Pale yellow. |
| `--celery` | `#486635` | Success and growth. |
| `--terracotta` | `#A43D12` | Errors **only**. Never a CTA, never a neutral figure. |

One product, one hue: each section owns its ground, saturated grounds may run
back-to-back (the reference pairs purple into brown), and cream returns between
runs. Text on a saturated ground is `--chip` via the `.on-color` helper, and
every text/background pair clears **4.5:1**.

The site is **light only** — no dark theme, no switcher. `apps/app` keeps its
System/Light/Dark switcher; that is not an inconsistency to resolve.

### Shape and layout

- **Buttons are fully pill** (`rounded-pill`), 14px/500, 12×16 padding. Primary
  is ink-on-chip; outline carries a hairline. The section CTA is the 56px
  outlined **arrow circle** (`CircleArrow`) — the headline talks, the circle
  says "go".
- Radii: 4 / 12 / 24 / pill. The nav is a floating `--chip` pill, radius 12,
  inset from the viewport, always white.
- Container is `max-w-site` (1264px). Sections run tall (`min-h-[80vh]`) with
  one product each.
- The footer ends with the serif wordmark at container width, then a hairline,
  then the legal line.

### Motion

- **framer-motion** for anything animated in React. No hand-rolled
  IntersectionObserver reveals, no `requestAnimationFrame` counters.
- **One easing:** `cubic-bezier(0.241, 0.969, 0.635, 0.997)` at 0.35s
  (`ease-ws`) for interactions; reveals are a single orchestrated stagger
  (opacity + 24–28px rise, ~1s ease-out), not per-element scroll effects.
- Everything respects `prefers-reduced-motion`, rendering the finished state
  immediately. Motion is decoration; nothing may depend on it to become legible.

### The application shell — `apps/app`

The signed-in app is a workspace, not a site: no top nav, no marketing footer.

- **An 88px icon rail** pinned left (`components/shell/app-rail.tsx`): search on
  top, six primary destinations (Home, Budgeting, Investing, Taxes, Calculators,
  Education), FinnaBot and Account at the bottom. Icon-only with hover tooltips
  and real accessible names; collapses to a bottom sheet under `lg`.
- **Compose screens from `components/shell/surface.tsx`** — `PageBar`,
  `PageBody`, `Panel`, `PanelTitle`, `EmptyState`, `ActionPill`, `Stat`. A new
  screen uses these rather than inventing its own card.
- **Every panel needs a real empty state.** `EmptyState` says what is missing
  and offers the one action that fixes it. Never a sample budget or a demo
  portfolio — a plausible fake on a first-run screen is precisely the lie house
  rule 1 forbids.

### Primitives

- **shadcn/ui**, configured by `apps/web/components.json`, living in
  `apps/web/components/ui/`.
- Compose from those primitives. A new one goes in `components/ui/` and follows
  the same pattern (Radix behaviour, local markup, `cva` variants, `cn` merging).
- Site-specific primitives (`Pill`, `CircleArrow`, `SectionLockup`, `Wordmark`)
  live in `components/site.tsx`.
- `lucide-react` for icons.

### shadcn configuration — verified with `shadcn info`

`apps/web/components.json` is the only real shadcn setup in this repo.

```
framework        Next.js 15.3.9 (next-app), RSC on, TypeScript
tailwind         v3 (3.4.19) · tailwind.config.ts · app/globals.css
style            new-york   base: radix   icons: lucide
importAlias      @  →  apps/web/*
registry         @shadcn  https://ui.shadcn.com/r/styles/{style}/{name}.json
```

Aliases, and the paths they resolve to:

| Alias | Path |
| --- | --- |
| `@/components` | `apps/web/components` |
| `@/components/ui` | `apps/web/components/ui` |
| `@/lib` | `apps/web/lib` |
| `@/lib/utils` | `apps/web/lib/utils` (exports `cn`) |
| `@/hooks` | `apps/web/hooks` (not created yet) |

**Installed primitives** — `button`, `dialog`, `input`, `label`, `slider`.
Import from the file, never a barrel; there is no `components/ui/index.ts`:

```ts
import { Button, buttonVariants } from "@/components/ui/button"
import {
    Dialog, DialogTrigger, DialogContent, DialogHeader,
    DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"
```

`Button` variants are `default | destructive | outline | secondary | ghost |
link`, sizes `default | sm | lg | icon`. There is no `primary` or `inverse`
variant — `default` is the ink pill CTA. Use `asChild` to wrap a link rather than
nesting a `Button` inside an `<a>`.

`Slider` is Radix: it takes `value={[n]}` and `onValueChange={([n]) => …}`, not
a bare number.

Adding a primitive: `cd apps/web && npx shadcn@latest add <name>`. It lands in
`components/ui/` and inherits the tokens already defined in `globals.css` — do
not hand-roll a component that the registry provides.

Supporting libraries in `apps/web`: framer-motion 11, lucide-react 0.454,
class-variance-authority 0.7, tailwind-merge 2.6, clsx 2.1, and four Radix
packages (dialog, slot, slider, label) pulled in by the primitives above.

**`apps/app` is not a shadcn project.** It has no `components.json` — the one
left by the original 2024 scaffold was deleted, because `shadcn info` read it
and reported the workspace as configured when it has zero Radix packages
(pruned in #99) and a single hand-rolled `components/ui/primitives.tsx`.
Running `shadcn add` there would install Radix into the workspace this design
system explicitly exempts. If that workspace is ever meant to adopt shadcn,
that's a deliberate decision about iOS parity, not a missing config file.

---

## Two-Pass Design Plan — required before any UI code

The `frontend-design` skill is committed at `.claude/skills/frontend-design/`.
It loads automatically. Follow it, and follow this process on top of it.

**No UI work starts with code.** Any task that creates a new screen, reshapes an
existing one, or changes the visual direction runs two passes first. Most of it
happens in thinking; only a confirmed direction reaches the user.

### Pass one — propose

Produce a compact token system for *this* brief:

- **Colour** — 4–6 named hex values, each with the job it does.
- **Type** — at least two roles: a characterful display face used with
  restraint, a body face that complements it, and a utility face for captions
  or data when the screen has figures.
- **Layout** — the concept in a sentence, plus an ASCII wireframe. Wireframes
  are for comparing structures cheaply; draw more than one when the structure
  is genuinely open.
- **Signature** — the one element the page is remembered by, and what about the
  subject it embodies.

### Pass two — critique, then revise

Review the plan against the brief before writing a line of code. The test:
would this same plan fall out of a similar prompt for a different product? If
yes, it's a default rather than a choice — revise it, and **say what changed
and why**.

Three looks that AI design currently defaults to, per the skill, so they need
justification rather than assumption:

1. Warm cream (near `#F4F1EA`), high-contrast serif display, terracotta accent.
2. Near-black background, single bright acid-green or vermilion accent.
3. Broadsheet layout — hairline rules, zero radius, dense newspaper columns.

**A brief that names a direction wins outright.** The skill is explicit about
this, and it applies here: `apps/web` runs the warm-light system measured off
wealthsimple.com — cream ground, warm neutrals, per-product section colours —
adopted at the user's explicit direction (Aug 2026). Warm cream with a serif
display is look 1's territory, but it is specified here, so it stands. The
critique pass exists for the axes the brief leaves free — spend that freedom on
something specific to FinnaCalc, not on a default.

### Then build

Write code only once the direction is confirmed, deriving every colour and type
decision from the plan. Spend boldness in one place: let the signature be the
memorable thing and keep everything around it quiet.

The quality floor is not optional and is not announced: responsive to mobile,
visible keyboard focus, `prefers-reduced-motion` respected, and every
text/background pair at 4.5:1 or better.

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
