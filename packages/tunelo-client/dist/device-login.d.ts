import { type IdpEndpoints, type TokenSet } from "./idp-client.js";
export interface DeviceAuthorization {
    deviceCode: string;
    userCode: string;
    verificationUri: string;
    verificationUriComplete: string | null;
    /** Seconds. */
    expiresIn: number;
    /** Seconds between polls. */
    interval: number;
}
/** Name the IdP shows on its approval page; it allows only `[\w ._'()-]`. */
export declare function deviceNameForIdp(name?: string): string;
/** Which OAuth client signs in, and for what (defaults: the CLI's). */
export interface DeviceClient {
    clientId?: string | undefined;
    scope?: string | undefined;
}
/**
 * Starts a device sign-in. `resource` may list several resources (RFC 8707):
 * the grant then holds all of them, and a refresh can ask for any one.
 */
export declare function startDeviceAuthorization(endpoints: IdpEndpoints, deviceName: string, resource: string | readonly string[], client?: DeviceClient): Promise<DeviceAuthorization>;
export interface PollOptions {
    /** The client that started the sign-in (default: the CLI's). */
    clientId?: string | undefined;
    /** Waits between polls; tests pass a fake. */
    sleep?: (ms: number) => Promise<void>;
    now?: () => number;
}
/**
 * Polls the token endpoint until the user approves, following RFC 8628
 * §3.5: `authorization_pending` waits, `slow_down` (and a 429) adds 5 s to
 * the interval, network trouble doubles it, `expired_token` /
 * `access_denied` and any other error end the login.
 */
export declare function pollForTokens(endpoints: IdpEndpoints, authorization: DeviceAuthorization, options?: PollOptions): Promise<TokenSet>;
export declare class DeviceLoginError extends Error {
    readonly error: string;
    constructor(error: string);
}
