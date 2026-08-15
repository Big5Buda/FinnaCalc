/**
 * Goal helpers: where a goal's "current" figure comes from, the emoji
 * suggestion, and the ring palette. Ported from GoalProgress.swift,
 * GoalEmoji.swift and GoalRing.swift.
 *
 * Deviation from the app, deliberately: iOS measures spending/income goals over
 * the live bank ledger (BankLedgerStore). The web has no ledger object — a
 * Plaid import lands as a history snapshot, exactly like the app's
 * importPlaidTransactions — so those kinds are measured over the budget lines
 * currently open, or by the hand-kept figure. Nothing is inferred from data the
 * web doesn't hold.
 */

import { monthlyAmount, type BudgetItem, type SavingsGoal } from "@/lib/budget/types"

export type GoalMeasure = { current: number; target: number; fraction: number }

export function measureGoal(goal: SavingsGoal, items: BudgetItem[]): GoalMeasure {
    let current = goal.currentAmount

    if (goal.kind !== "saving" && !goal.manualOnly) {
        const wanted = goal.kind === "spending" ? "expense" : "income"
        current = items
            .filter((item) => item.type === wanted)
            .filter((item) => !goal.category || item.category === goal.category)
            .reduce((sum, item) => sum + monthlyAmount(item), 0)
    }

    const target = goal.targetAmount
    const fraction = target > 0 ? Math.min(Math.max(current / target, 0), 1) : 0
    return { current, target, fraction }
}

/** A spending goal at or past its limit is over, not complete. */
export function goalIsOver(goal: SavingsGoal, measure: GoalMeasure): boolean {
    return goal.kind === "spending" && measure.target > 0 && measure.current >= measure.target
}

// MARK: - Emoji

/** Shown when nothing matches — reads as "a goal", never as a bug. */
export const GOAL_EMOJI_FALLBACK = "🎯"

/** (keywords, emoji), first match wins; specific objects before generic money words. */
const EMOJI_MAP: { keywords: string[]; emoji: string }[] = [
    { keywords: ["car", "truck", "vehicle", "auto", "tesla", "mustang", "jeep"], emoji: "🚗" },
    { keywords: ["motorcycle", "motorbike", "harley"], emoji: "🏍️" },
    { keywords: ["ev", "charger"], emoji: "⚡" },
    { keywords: ["house", "home", "condo", "apartment", "property", "mortgage", "downpayment", "down payment"], emoji: "🏠" },
    { keywords: ["renovation", "remodel", "reno", "repair", "improvement"], emoji: "🔨" },
    { keywords: ["furniture", "couch", "sofa", "mattress", "bed"], emoji: "🛋️" },
    { keywords: ["wedding", "engagement", "ring", "marriage", "bridal"], emoji: "💍" },
    { keywords: ["honeymoon"], emoji: "🏝️" },
    { keywords: ["baby", "newborn", "nursery", "maternity", "diaper"], emoji: "👶" },
    { keywords: ["vacation", "trip", "travel", "getaway", "flight", "disney", "cruise", "europe"], emoji: "✈️" },
    { keywords: ["beach", "resort"], emoji: "🏖️" },
    { keywords: ["phone", "iphone", "android", "smartphone", "pixel"], emoji: "📱" },
    { keywords: ["laptop", "computer", "macbook", "desktop", "pc"], emoji: "💻" },
    { keywords: ["camera", "lens", "gopro"], emoji: "📷" },
    { keywords: ["tv", "television"], emoji: "📺" },
    { keywords: ["console", "playstation", "xbox", "gaming", "nintendo", "gamer"], emoji: "🎮" },
    { keywords: ["bike", "bicycle", "cycle"], emoji: "🚲" },
    { keywords: ["boat", "yacht", "sailboat", "kayak"], emoji: "⛵" },
    { keywords: ["college", "school", "tuition", "education", "degree", "university", "student", "course"], emoji: "🎓" },
    { keywords: ["book", "library"], emoji: "📚" },
    { keywords: ["emergency", "rainy", "rainy day", "safety net", "cushion"], emoji: "🛟" },
    { keywords: ["retirement", "retire", "pension", "nest egg", "401k", "ira", "roth"], emoji: "🌴" },
    { keywords: ["business", "startup", "company", "venture", "llc", "shop"], emoji: "💼" },
    { keywords: ["gym", "fitness", "workout", "weights", "peloton", "muscle"], emoji: "🏋️" },
    { keywords: ["dog", "puppy"], emoji: "🐕" },
    { keywords: ["cat", "kitten"], emoji: "🐈" },
    { keywords: ["pet", "vet"], emoji: "🐾" },
    { keywords: ["medical", "surgery", "hospital", "dental", "dentist", "braces", "health"], emoji: "🏥" },
    { keywords: ["debt", "loan", "credit card", "payoff", "creditcard"], emoji: "💳" },
    { keywords: ["moving", "move", "relocation", "relocate"], emoji: "📦" },
    { keywords: ["christmas", "xmas", "holiday"], emoji: "🎄" },
    { keywords: ["gift", "present", "birthday", "party"], emoji: "🎁" },
    { keywords: ["guitar", "piano", "music", "instrument", "drum"], emoji: "🎸" },
    { keywords: ["watch", "rolex", "jewelry", "jewellery"], emoji: "⌚" },
    { keywords: ["shoe", "sneaker"], emoji: "👟" },
    { keywords: ["clothes", "clothing", "wardrobe", "outfit"], emoji: "👗" },
    { keywords: ["concert", "festival", "ticket", "tickets", "show"], emoji: "🎟️" },
    { keywords: ["camp", "tent", "hiking", "hike", "outdoor"], emoji: "🏕️" },
    { keywords: ["ski", "snowboard"], emoji: "⛷️" },
    { keywords: ["garden", "plant", "landscaping"], emoji: "🪴" },
    { keywords: ["solar", "panel"], emoji: "☀️" },
    { keywords: ["coffee", "espresso"], emoji: "☕" },
    { keywords: ["freedom", "dream", "fun", "splurge", "treat"], emoji: "✨" },
    { keywords: ["savings", "save", "fund", "money", "cash", "wealth", "invest", "stash"], emoji: "💰" },
]

/** Whole-word match (with a light plural fold) so "carnival" doesn't become 🚗. */
export function suggestGoalEmoji(name: string): string {
    const words = new Set(
        (name.toLowerCase().match(/[a-z0-9']+/g) ?? []).flatMap((word) =>
            word.endsWith("s") && word.length > 3 ? [word, word.slice(0, -1)] : [word]
        )
    )
    const text = name.toLowerCase()
    for (const entry of EMOJI_MAP) {
        const hit = entry.keywords.some((keyword) =>
            keyword.includes(" ") ? text.includes(keyword) : words.has(keyword)
        )
        if (hit) return entry.emoji
    }
    return GOAL_EMOJI_FALLBACK
}

export function resolveGoalEmoji(goal: SavingsGoal): string {
    return goal.emoji || suggestGoalEmoji(goal.name)
}

/** The curated picker palette. */
export const GOAL_EMOJI_PALETTE = [
    "🎯", "💰", "🏦", "✨", "🎁", "🎉",
    "🚗", "🏍️", "🚲", "⛵", "✈️", "🏝️",
    "🏠", "🔨", "🛋️", "📦", "🌴", "🏖️",
    "💍", "👶", "🐕", "🐈", "🐾", "🏥",
    "📱", "💻", "📷", "📺", "🎮", "⌚",
    "🎓", "📚", "🛟", "💼", "🏋️", "💳",
    "🎸", "👟", "👗", "🎟️", "🏕️", "⛷️",
    "🪴", "☀️", "☕", "⚡",
]

// MARK: - Ring colour

/**
 * Swatches offered in the goal form, as RRGGBB. Drawn from the donut palette so
 * a chosen ring colour matches colours the app already renders. The default is
 * deliberately not the first entry: null means the theme's positive green, which
 * keeps adapting to light/dark.
 */
export const GOAL_RING_PALETTE = [
    "3B5BDB", "0CA678", "1098AD", "7048E8", "9C36B5", "E64980",
    "E03131", "E8590C", "F08C00", "74B816", "0B7285", "495057",
]

/** The stored choice as a CSS colour; null for the default and anything unparseable. */
export function goalRingColor(hex?: string | null): string | null {
    if (!hex || !/^[0-9a-fA-F]{6}$/.test(hex)) return null
    return `#${hex}`
}
