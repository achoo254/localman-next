export declare const IDP_DEFAULTS: {
    readonly issuer: "https://auth.hoandat.com";
    readonly clientId: "tunelo-cli";
    /** Resource indicator (RFC 8707) = the access token's `aud`. */
    readonly resource: "https://tunnel.hoandat.com";
    readonly scope: "openid offline_access tunnels:open tunnels:read";
};
export declare const DEVICE_CODE_GRANT = "urn:ietf:params:oauth:grant-type:device_code";
export interface IdpEndpoints {
    deviceAuthorization: string;
    token: string;
    revocation: string | null;
}
export interface TokenSet {
    accessToken: string;
    refreshToken: string | null;
    idToken: string | null;
    /** Seconds. */
    expiresIn: number;
}
/** OAuth error answered by the IdP (`invalid_grant`, `slow_down`…). */
export declare class OAuthResponseError extends Error {
    readonly error: string;
    readonly status: number;
    constructor(error: string, status: number);
}
export declare function discover(issuer: string): Promise<IdpEndpoints>;
export declare function postForm(url: string, form: Record<string, string>): Promise<{
    status: number;
    body: unknown;
}>;
/** Turns a token-endpoint reply into tokens, or throws its OAuth error. */
export declare function tokenSetOf(reply: {
    status: number;
    body: unknown;
}): TokenSet;
/** Exchanges a refresh token. The IdP rotates it: use the new one. */
export declare function refreshTokens(endpoints: IdpEndpoints, refreshToken: string, resource: string): Promise<TokenSet>;
/** Revokes a refresh token (and with it the grant of this machine). */
export declare function revokeToken(endpoints: IdpEndpoints, refreshToken: string): Promise<void>;
/** `sub` from an ID token. Display only: the IdP is trusted over TLS here. */
export declare function subjectOf(idToken: string | null): string | null;
