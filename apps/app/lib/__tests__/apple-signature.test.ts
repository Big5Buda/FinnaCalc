import { afterEach, expect, it, vi } from "vitest"
import { X509Certificate } from "node:crypto"
import { appleRootCertificates } from "../apple-root-certificates"
import { verifyAppleNotification } from "../apple-notifications"
import { verifySubmittedTransactions } from "../apple-subscriptions"

afterEach(() => vi.unstubAllEnvs())
it("loads three valid self-signed Apple trust roots", () => {
    expect(appleRootCertificates).toHaveLength(3)
    for (const root of appleRootCertificates) {
        const cert = new X509Certificate(root)
        expect(cert.subject).toContain("Apple")
        expect(cert.verify(cert.publicKey)).toBe(true)
    }
})
it("the real Apple verifier rejects an unsigned fabricated premium transaction", async () => {
    vi.stubEnv("APP_STORE_ISSUER_ID", "fixture-issuer")
    vi.stubEnv("APP_STORE_KEY_ID", "fixture-key")
    vi.stubEnv("APP_STORE_PRIVATE_KEY", "fixture-key-never-sent")
    vi.stubEnv("APP_STORE_ALLOW_SANDBOX", "false")
    const header = Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url")
    const payload = Buffer.from(JSON.stringify({ bundleId: "com.finnacalc.FinnaCalcIOS", productId: "com.finnacalc.pro.annual", expiresDate: Date.now() + 31_536_000_000 })).toString("base64url")
    await expect(verifySubmittedTransactions([`${header}.${payload}.`])).rejects.toMatchObject({ status: 400 })
})

it("the real Apple verifier rejects a fabricated unsigned server notification", async () => {
    vi.stubEnv("APP_STORE_ISSUER_ID", "fixture-issuer")
    vi.stubEnv("APP_STORE_KEY_ID", "fixture-key")
    vi.stubEnv("APP_STORE_PRIVATE_KEY", "fixture-key-never-sent")
    vi.stubEnv("APP_STORE_ALLOW_SANDBOX", "false")
    const header = Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url")
    const payload = Buffer.from(JSON.stringify({ notificationType: "DID_RENEW", data: { bundleId: "com.finnacalc.FinnaCalcIOS", appAppleId: 6787539598, environment: "Production" } })).toString("base64url")
    await expect(verifyAppleNotification(`${header}.${payload}.`)).rejects.toMatchObject({ status: 400 })
})
