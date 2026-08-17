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
variant — `default` is the mint CTA. Use `asChild` to wrap a link rather than
nesting a `Button` inside an `<a>`.

`Slider` is Radix: it takes `value={[n]}` and `onValueChange={([n]) => …}`, not
a bare number.

Adding a primitive: `cd apps/web && npx shadcn@latest add <name>`. It lands in
`components/ui/` and inherits the tokens already defined in `globals.css` — do
not hand-roll a component that the registry provides.

Supporting libraries in `apps/web`: framer-motion 11, lucide-react 0.454,
class-variance-authority 0.7, tailwind-merge 2.6, clsx 2.1, and four Radix
packages (dialog, slot, slider, label) pulled in by the primitives above.

**`apps/app` is not a shadcn project**, despite carrying a stale
`components.json` from the original 2024 scaffold. It has zero Radix packages
(pruned in #99) and its UI lives in one hand-rolled file,
`components/ui/primitives.tsx`. Running `shadcn add` there would install Radix
into the workspace this design system explicitly exempts. Don't. That
`components.json` is a leftover and can be deleted.

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
this, and it applies here: `apps/web` runs Deep Obsidian with Electric Mint and
Vermilion, which is look 2 above. That was specified hex by hex, so it stands.
The critique pass exists for the axes a brief leaves free — spend that freedom
on something specific to FinnaCalc, not on a default.

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
