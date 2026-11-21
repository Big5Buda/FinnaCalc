/** Pure exact-decimal helpers (no imports, so any module can share them
 * without cycles). Money thresholds are never compared via a binary float
 * product: 0.29 * 100 === 28.999999999999996 in IEEE-754. */

function tenTo(power: number): bigint {
    let r = BigInt(1)
    for (let i = 0; i < power; i++) r *= BigInt(10)
    return r
}

/** Exact decimal value of a non-negative number's shortest round-trip text
 * (Number#toString, which may use an exponent), as an integer and scale. */
function decimal(text: string): { n: bigint; scale: number } | null {
    const m = /^(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(text)
    if (!m) return null
    const fraction = m[2] ?? "", exponent = Number(m[3] ?? 0)
    let n = BigInt(m[1] + fraction), scale = fraction.length - exponent
    if (scale < 0) { n *= tenTo(-scale); scale = 0 }
    return { n, scale }
}

/** units × price < minimum, compared exactly. Units are canonical (checked
 * precision), price is a provider quote number, minimum is a canonical
 * decimal string. Anything unparseable, negative or non-finite counts as
 * below, so callers fail closed. */
export function productBelow(units: number, price: number, minimum: string): boolean {
    if (!Number.isFinite(units) || !Number.isFinite(price)) return true
    const u = decimal(String(units)), p = decimal(String(price)), m = decimal(minimum)
    if (!u || !p || !m) return true
    const scale = Math.max(u.scale + p.scale, m.scale)
    return u.n * p.n * tenTo(scale - u.scale - p.scale) < m.n * tenTo(scale - m.scale)
}
