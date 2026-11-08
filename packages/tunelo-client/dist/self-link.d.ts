export interface SelfLink {
    /** Link token, shown once. */
    token: string;
    /** Tunelo's id of the link (`tunelo` lists and revokes it). */
    linkId: string;
    /** `https://m-<hash>.<domain>/.tunelo/forward` of this machine. */
    forwardUrl: string;
}
export interface SelfLinkOptions {
    /** Tunelo server, e.g. `https://tunnel.hoandat.com`. */
    serverUrl: string;
    /** The account's access token for the server's resource (`tunnels:open`). */
    accessToken: string;
    /** The machine tunnel's `deviceId`. */
    deviceId: string;
    /** Name of the app shown in the machine's link list. */
    clientName: string;
    /** Defaults to the global `fetch`; tests pass their own. */
    fetch?: typeof fetch;
}
/** The server refused or answered something else. Never carries a token. */
export declare class SelfLinkError extends Error {
    readonly status: number | null;
    readonly code: string | null;
    constructor(status: number | null, code: string | null);
}
/** `POST /api/links/self` on the Tunelo server. */
export declare function linkMachineToApp(options: SelfLinkOptions): Promise<SelfLink>;
