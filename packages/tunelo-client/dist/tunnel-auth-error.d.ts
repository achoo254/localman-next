import { type TunnelKind } from "./shared/constants.js";
/** The server refused the connection; `code` is its `TUNELO_*` code. */
export declare class TunnelAuthError extends Error {
    readonly code?: string | undefined;
    /** A refused token stays refused: no point reconnecting with it. */
    readonly fatal: boolean;
    constructor(message: string, code?: string | undefined);
}
export declare function isFatal(err: unknown): boolean;
/**
 * Whether the reconnect loop gives up on `err`. A machine tunnel also stops
 * on a full quota: unlike `tunelo http`, which waits for one of the user's
 * own tunnels to close, an agent should report it rather than retry forever.
 */
export declare function stopsReconnecting(err: unknown, kind: TunnelKind | undefined): boolean;
