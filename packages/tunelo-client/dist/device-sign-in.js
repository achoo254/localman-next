/** Whole device-flow sign-in (RFC 8628) into a caller-chosen session store. */
import { deviceNameForIdp, pollForTokens, startDeviceAuthorization, } from "./device-login.js";
import { withFileLock } from "./file-lock.js";
import { discover } from "./idp-client.js";
import { resourceOfIssuer } from "./server-identity.js";
import { sessionFromTokens } from "./session.js";
/**
 * Signs in and saves the session (under the store's lock) before returning
 * it. Throws `DeviceLoginError` when the user denies or the code expires.
 * A session already in the store is replaced, not revoked: revoke it first
 * with `revokeToken` if the old grant should end.
 */
export async function deviceSignIn(options) {
    const { issuer, store } = options;
    const endpoints = await discover(issuer);
    const authorization = await startDeviceAuthorization(endpoints, deviceNameForIdp(options.deviceName), resourceOfIssuer(issuer));
    await options.onCode(authorization);
    const tokens = await pollForTokens(endpoints, authorization, options.poll);
    const session = sessionFromTokens(issuer, tokens, undefined, Date.now());
    await withFileLock(store.lockPath, async () => store.save(session));
    return session;
}
