/** Navigation only: no tokens or personal context are stored here. */
export const AUTH_RETURN_KEY = "finnacalc.auth.return-path"
export function safeAuthReturn(value: string | null): string {
    if (!value || !value.startsWith("/")) return "/"
    try {
        let decoded=value
        for (let i=0;i<3;i++) { const next=decodeURIComponent(decoded); if(next===decoded) break; decoded=next }
        if (decoded.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(decoded)) return "/"
        const url=new URL(value,"https://finnacalc.invalid")
        if(url.origin!=="https://finnacalc.invalid" || /^\/(?:sign-in|sign-up)(?:\/|$)/.test(url.pathname) || url.pathname.startsWith("/auth/")) return "/"
        return url.pathname+url.search+url.hash
    } catch { return "/" }
}
