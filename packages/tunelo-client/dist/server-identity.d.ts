/**
 * What a Tunelo server stands for, by convention from its host and never
 * from anything the server says: `tunnel.<domain>` is served for the IdP
 * `https://auth.<domain>`, and tokens for it carry the audience
 * `https://tunnel.<domain>`. `undefined` for any other host (loopback,
 * custom servers).
 */
export declare function serverIdentity(serverUrl: string): {
    readonly issuer: string;
    readonly resource: string;
} | undefined;
/**
 * The audience to ask the IdP `issuer` for: `https://tunnel.<domain>` of
 * `https://auth.<domain>`; the default one for any other issuer (a local
 * or staging IdP).
 */
export declare function resourceOfIssuer(issuer: string): string;
/**
 * Whether the account token of `sessionIssuer` may go to `serverUrl`: only
 * to the Tunelo of the same domain (`https://auth.<d>` signs in for
 * `tunnel.<d>`), over TLS, or to loopback for local development. Any other
 * server could replay the token against the real one.
 */
export declare function acceptsAccountToken(serverUrl: string, sessionIssuer: string): boolean;
