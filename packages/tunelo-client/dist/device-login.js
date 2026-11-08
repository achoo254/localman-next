/** `tunelo login`: OAuth 2.0 Device Authorization Grant (RFC 8628). */
import { hostname } from "node:os";
import { DEVICE_CODE_GRANT, IDP_DEFAULTS, OAuthResponseError, postForm, tokenSetOf, } from "./idp-client.js";
/** Name the IdP shows on its approval page; it allows only `[\w ._'()-]`. */
export function deviceNameForIdp(name = hostname()) {
    const cleaned = name
        .replace(/[^A-Za-z0-9 ._'()-]/g, "")
        .slice(0, 64)
        .trim();
    return cleaned || "tunelo";
}
function str(value) {
    return typeof value === "string" && value.length > 0 ? value : null;
}
/**
 * Starts a device sign-in. `resource` may list several resources (RFC 8707):
 * the grant then holds all of them, and a refresh can ask for any one.
 */
export async function startDeviceAuthorization(endpoints, deviceName, resource, client = {}) {
    const { status, body } = await postForm(endpoints.deviceAuthorization, {
        client_id: client.clientId ?? IDP_DEFAULTS.clientId,
        scope: client.scope ?? IDP_DEFAULTS.scope,
        resource,
        device_name: deviceName,
    });
    const record = typeof body === "object" && body !== null
        ? body
        : {};
    if (status >= 400 || record.error) {
        throw new OAuthResponseError(str(record.error) ?? "server_error", status);
    }
    const deviceCode = str(record.device_code);
    const userCode = str(record.user_code);
    const verificationUri = str(record.verification_uri);
    if (!deviceCode || !userCode || !verificationUri) {
        throw new Error("Device authorization response is incomplete");
    }
    return {
        deviceCode,
        userCode,
        verificationUri,
        verificationUriComplete: str(record.verification_uri_complete),
        expiresIn: typeof record.expires_in === "number" ? record.expires_in : 600,
        interval: typeof record.interval === "number" ? record.interval : 5,
    };
}
const SLOW_DOWN_STEP_S = 5;
const MAX_NETWORK_FAILURES = 3;
/**
 * Polls the token endpoint until the user approves, following RFC 8628
 * §3.5: `authorization_pending` waits, `slow_down` (and a 429) adds 5 s to
 * the interval, network trouble doubles it, `expired_token` /
 * `access_denied` and any other error end the login.
 */
export async function pollForTokens(endpoints, authorization, options = {}) {
    const sleep = options.sleep ??
        ((ms) => new Promise((r) => setTimeout(r, ms)));
    const now = options.now ?? Date.now;
    const deadline = now() + authorization.expiresIn * 1000;
    let interval = authorization.interval;
    let networkFailures = 0;
    while (now() < deadline) {
        await sleep(interval * 1000);
        try {
            return tokenSetOf(await postForm(endpoints.token, {
                grant_type: DEVICE_CODE_GRANT,
                device_code: authorization.deviceCode,
                client_id: options.clientId ?? IDP_DEFAULTS.clientId,
                ...(options.resource ? { resource: options.resource } : {}),
            }));
        }
        catch (err) {
            if (!(err instanceof OAuthResponseError) || err.status >= 500) {
                // A blip should not cost the user the code; back off (§3.5).
                if (++networkFailures > MAX_NETWORK_FAILURES)
                    throw err;
                interval *= 2;
                continue;
            }
            networkFailures = 0;
            if (err.error === "authorization_pending")
                continue;
            // The IdP rate-limits per IP (429): treat it like slow_down.
            if (err.error === "slow_down" || err.status === 429) {
                interval += SLOW_DOWN_STEP_S;
                continue;
            }
            throw new DeviceLoginError(err.error);
        }
    }
    throw new DeviceLoginError("expired_token");
}
const MESSAGES = {
    expired_token: "The code expired before it was approved. Run `tunelo login` again.",
    access_denied: "The sign-in was denied in the browser.",
};
export class DeviceLoginError extends Error {
    error;
    constructor(error) {
        super(MESSAGES[error] ?? `Sign-in failed (${error}).`);
        this.error = error;
        this.name = "DeviceLoginError";
    }
}
