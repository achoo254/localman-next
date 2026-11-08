/**
 * Links this machine to an app of its account (Localman): the Tunelo
 * server mints a link token that lists the machine's tunnels and may send
 * requests to its loopback through the machine tunnel. The caller hands
 * the token to the app and keeps no copy.
 */
const HTTP_TIMEOUT_MS = 10_000;
const MAX_TOKEN_LENGTH = 512;
/** The server refused or answered something else. Never carries a token. */
export class SelfLinkError extends Error {
    status;
    code;
    constructor(status, code) {
        super(`Tunelo did not link this machine (${code ?? status ?? "no answer"})`);
        this.status = status;
        this.code = code;
        this.name = "SelfLinkError";
    }
}
function isRecord(value) {
    return typeof value === "object" && value !== null;
}
function errorCodeOf(body) {
    if (!isRecord(body) || !isRecord(body.error))
        return null;
    return typeof body.error.code === "string" ? body.error.code : null;
}
function parseSelfLink(body) {
    if (!isRecord(body))
        return null;
    const { token, linkId, forwardUrl } = body;
    if (typeof token !== "string" ||
        token.length === 0 ||
        token.length > MAX_TOKEN_LENGTH ||
        typeof linkId !== "string" ||
        typeof forwardUrl !== "string" ||
        !URL.canParse(forwardUrl) ||
        new URL(forwardUrl).protocol !== "https:") {
        return null;
    }
    return { token, linkId, forwardUrl };
}
/** `POST /api/links/self` on the Tunelo server. */
export async function linkMachineToApp(options) {
    const fetchImpl = options.fetch ?? fetch;
    let res;
    try {
        res = await fetchImpl(new URL("/api/links/self", options.serverUrl), {
            method: "POST",
            headers: {
                authorization: `Bearer ${options.accessToken}`,
                "content-type": "application/json",
                accept: "application/json",
            },
            body: JSON.stringify({
                deviceId: options.deviceId,
                clientName: options.clientName,
            }),
            redirect: "error",
            signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
        });
    }
    catch {
        throw new SelfLinkError(null, null);
    }
    const body = await res.json().catch(() => null);
    if (!res.ok)
        throw new SelfLinkError(res.status, errorCodeOf(body));
    const link = parseSelfLink(body);
    if (!link)
        throw new SelfLinkError(res.status, null);
    return link;
}
