import { generateKeyPairSync, sign, verify } from "node:crypto"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AppleIdentityMismatchError, revokeAppleAuthorization } from "@/lib/apple-revocation"

const appleKeys = generateKeyPairSync("rsa", { modulusLength: 2048 })
const clientKeys = generateKeyPairSync("ec", { namedCurve: "P-256" })
const clientID = "com.finnacalc.FinnaCalcIOS"
const appleJWK = { ...appleKeys.publicKey.export({ format: "jwk" }), kid: "apple-test-key" }

function identity(claims: Record<string, unknown> = {}) {
    const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: "apple-test-key" })).toString("base64url")
    const payload = Buffer.from(JSON.stringify({
        iss: "https://appleid.apple.com", aud: clientID,
        sub: "linked-apple-user", exp: Date.now() / 1000 + 300, ...claims,
    })).toString("base64url")
    const input = `${header}.${payload}`
    return `${input}.${sign("RSA-SHA256", Buffer.from(input), appleKeys.privateKey).toString("base64url")}`
}

function appleResponses(idToken = identity(), refreshToken: string | undefined = "revocable-refresh") {
    return vi.fn()
        .mockResolvedValueOnce(Response.json({ id_token: idToken, refresh_token: refreshToken, access_token: "revocable-access" }))
        .mockResolvedValueOnce(Response.json({ keys: [appleJWK] }))
        .mockResolvedValueOnce(new Response(null, { status: 200 }))
}

beforeEach(() => {
    vi.stubEnv("APPLE_SIGN_IN_CLIENT_ID", clientID)
    vi.stubEnv("APPLE_TEAM_ID", "test-team")
    vi.stubEnv("APPLE_SIGN_IN_KEY_ID", "test-key")
    vi.stubEnv("APPLE_SIGN_IN_PRIVATE_KEY", clientKeys.privateKey.export({ format: "pem", type: "pkcs8" }).toString())
})
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe("Apple authorization revocation", () => {
    it("exchanges a native code and revokes the verified user's refresh token with a valid ES256 client secret", async () => {
        const fetch = appleResponses()
        vi.stubGlobal("fetch", fetch)
        await revokeAppleAuthorization("single-use-code", ["linked-apple-user"])
        const exchange = fetch.mock.calls[0][1] as RequestInit
        const form = exchange.body as URLSearchParams
        expect(form.get("code")).toBe("single-use-code")
        expect(form.has("redirect_uri")).toBe(false)
        const [header, payload, signature] = form.get("client_secret")!.split(".")
        expect(verify("sha256", Buffer.from(`${header}.${payload}`),
            { key: clientKeys.publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(signature, "base64url"))).toBe(true)
        expect(JSON.parse(Buffer.from(payload, "base64url").toString())).toMatchObject({
            iss: "test-team", aud: "https://appleid.apple.com", sub: clientID,
        })
        const revoke = fetch.mock.calls[2]
        expect(revoke[0]).toBe("https://appleid.apple.com/auth/revoke")
        expect((revoke[1].body as URLSearchParams).get("token")).toBe("revocable-refresh")
        expect((revoke[1].body as URLSearchParams).get("token_type_hint")).toBe("refresh_token")
    })

    it("does not revoke an Apple identity belonging to another FinnaCalc user", async () => {
        const fetch = appleResponses(identity({ sub: "other-apple-user" }))
        vi.stubGlobal("fetch", fetch)
        await expect(revokeAppleAuthorization("code", ["linked-apple-user"])).rejects.toBeInstanceOf(AppleIdentityMismatchError)
        expect(fetch).toHaveBeenCalledTimes(2)
    })

    it.each([{ aud: "other-client" }, { iss: "https://attacker.example" }, { exp: 1 }])(
        "rejects signed but invalid identity claims %j before revocation", async (claims) => {
            const fetch = appleResponses(identity(claims))
            vi.stubGlobal("fetch", fetch)
            await expect(revokeAppleAuthorization("code", ["linked-apple-user"])).rejects.toThrow("claims")
            expect(fetch).toHaveBeenCalledTimes(2)
        }
    )

    it("rejects a forged token even when its subject matches", async () => {
        const token = identity().split(".")
        token[2] = Buffer.alloc(256).toString("base64url")
        const fetch = appleResponses(token.join("."))
        vi.stubGlobal("fetch", fetch)
        await expect(revokeAppleAuthorization("code", ["linked-apple-user"])).rejects.toThrow("signature")
        expect(fetch).toHaveBeenCalledTimes(2)
    })

    it("uses an access token when Apple does not return a refresh token", async () => {
        const fetch = appleResponses(identity(), "")
        vi.stubGlobal("fetch", fetch)
        await revokeAppleAuthorization("code", ["linked-apple-user"])
        expect((fetch.mock.calls[2][1].body as URLSearchParams).get("token_type_hint")).toBe("access_token")
    })

    it("does not claim revocation when Apple rejects it", async () => {
        const fetch = appleResponses()
        fetch.mockReset()
            .mockResolvedValueOnce(Response.json({ id_token: identity(), refresh_token: "refresh" }))
            .mockResolvedValueOnce(Response.json({ keys: [appleJWK] }))
            .mockResolvedValueOnce(new Response(null, { status: 503 }))
        vi.stubGlobal("fetch", fetch)
        await expect(revokeAppleAuthorization("code", ["linked-apple-user"])).rejects.toThrow("revoke request failed")
    })

    it("fails before sending secrets when server credentials are missing", async () => {
        vi.stubEnv("APPLE_SIGN_IN_PRIVATE_KEY", "")
        const fetch = vi.fn()
        vi.stubGlobal("fetch", fetch)
        await expect(revokeAppleAuthorization("code", ["linked-apple-user"])).rejects.toThrow("not configured")
        expect(fetch).not.toHaveBeenCalled()
    })
})
