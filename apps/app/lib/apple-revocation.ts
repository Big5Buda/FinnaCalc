import { createPrivateKey, createPublicKey, sign, verify, type JsonWebKey } from "node:crypto"

/** Apple credentials stay server-side. Codes are exchanged only for deletion;
 * token responses are never logged or stored after revocation.
 * https://developer.apple.com/documentation/technotes/tn3194-handling-account-deletions-and-revoking-tokens-for-sign-in-with-apple
 */
export class AppleIdentityMismatchError extends Error {
    constructor() { super("Use the Apple Account linked to this FinnaCalc account.") }
}

function clientCredentials() {
    const clientID = process.env.APPLE_SIGN_IN_CLIENT_ID
    const teamID = process.env.APPLE_TEAM_ID
    const keyID = process.env.APPLE_SIGN_IN_KEY_ID
    const privateKey = process.env.APPLE_SIGN_IN_PRIVATE_KEY?.replace(/\\n/g, "\n")
    if (!clientID || !teamID || !keyID || !privateKey) {
        throw new Error("Apple revocation credentials are not configured.")
    }
    const now = Math.floor(Date.now() / 1000)
    const header = Buffer.from(JSON.stringify({ alg: "ES256", kid: keyID })).toString("base64url")
    const payload = Buffer.from(JSON.stringify({
        iss: teamID, iat: now - 30, exp: now + 300,
        aud: "https://appleid.apple.com", sub: clientID,
    })).toString("base64url")
    const input = `${header}.${payload}`
    const signature = sign("sha256", Buffer.from(input), {
        key: createPrivateKey(privateKey), dsaEncoding: "ieee-p1363",
    }).toString("base64url")
    return { clientID, clientSecret: `${input}.${signature}` }
}

async function applePost(path: "token" | "revoke", body: URLSearchParams) {
    const response = await fetch(`https://appleid.apple.com/auth/${path}`, {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body, cache: "no-store", signal: AbortSignal.timeout(15_000),
    })
    if (!response.ok) throw new Error(`Apple ${path} request failed (${response.status}).`)
    return response
}

async function verifiedSubject(idToken: string, clientID: string): Promise<string> {
    const parts = idToken.split(".")
    if (parts.length !== 3) throw new Error("Apple returned an invalid identity token.")
    const header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"))
    if (header.alg !== "RS256" || typeof header.kid !== "string") {
        throw new Error("Apple returned an unsupported identity signature.")
    }
    const response = await fetch("https://appleid.apple.com/auth/keys", {
        cache: "no-store", signal: AbortSignal.timeout(15_000),
    })
    if (!response.ok) throw new Error("Apple signing keys are unavailable.")
    const keys = await response.json() as { keys?: (JsonWebKey & { kid?: string })[] }
    const jwk = keys.keys?.find((key) => key.kid === header.kid && key.kty === "RSA")
    if (!jwk || !verify("RSA-SHA256", Buffer.from(`${parts[0]}.${parts[1]}`),
        createPublicKey({ key: jwk, format: "jwk" }), Buffer.from(parts[2], "base64url"))) {
        throw new Error("Apple identity signature could not be verified.")
    }
    const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"))
    if (claims.iss !== "https://appleid.apple.com" || claims.aud !== clientID
        || typeof claims.exp !== "number" || claims.exp <= Date.now() / 1000
        || typeof claims.sub !== "string" || !claims.sub) {
        throw new Error("Apple identity claims could not be verified.")
    }
    return claims.sub
}

export async function revokeAppleAuthorization(code: string, expectedSubjects: string[]): Promise<void> {
    const { clientID, clientSecret } = clientCredentials()
    const response = await applePost("token", new URLSearchParams({
        client_id: clientID, client_secret: clientSecret, code, grant_type: "authorization_code",
    }))
    const tokens = await response.json() as { id_token?: unknown; refresh_token?: unknown; access_token?: unknown }
    if (typeof tokens.id_token !== "string") throw new Error("Apple did not return an identity token.")
    const subject = await verifiedSubject(tokens.id_token, clientID)
    if (!expectedSubjects.includes(subject)) throw new AppleIdentityMismatchError()
    const token = typeof tokens.refresh_token === "string" && tokens.refresh_token
        ? tokens.refresh_token : tokens.access_token
    if (typeof token !== "string" || !token) throw new Error("Apple did not return a revocable token.")
    await applePost("revoke", new URLSearchParams({
        client_id: clientID, client_secret: clientSecret, token,
        token_type_hint: token === tokens.refresh_token ? "refresh_token" : "access_token",
    }))
}
