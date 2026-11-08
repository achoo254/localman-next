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
export declare function startDeviceAuthorization(endpoints: IdpEndpoints, deviceName: string, resource: string): Promise<DeviceAuthorization>;
export interface PollOptions {
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
