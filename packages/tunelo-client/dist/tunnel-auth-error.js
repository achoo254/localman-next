import { TUNNEL_REFUSAL_CODES } from "./shared/constants.js";
/** Refusals that retrying the same request cannot turn around. */
const FATAL_CODES = new Set([
    "TUNELO_AUTH_003",
    "TUNELO_AUTH_004",
    TUNNEL_REFUSAL_CODES.SUBDOMAIN_HELD,
]);
/** The server refused the connection; `code` is its `TUNELO_*` code. */
export class TunnelAuthError extends Error {
    code;
    /** A refused token stays refused: no point reconnecting with it. */
    fatal;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "TunnelAuthError";
        this.fatal = code !== undefined && FATAL_CODES.has(code);
    }
}
export function isFatal(err) {
    return (typeof err === "object" &&
        err !== null &&
        "fatal" in err &&
        err.fatal === true);
}
/**
 * Whether the reconnect loop gives up on `err`. A machine tunnel also stops
 * on a full quota: unlike `tunelo http`, which waits for one of the user's
 * own tunnels to close, an agent should report it rather than retry forever.
 */
export function stopsReconnecting(err, kind) {
    if (isFatal(err))
        return true;
    return (kind === "machine" &&
        err instanceof TunnelAuthError &&
        err.code === TUNNEL_REFUSAL_CODES.QUOTA_EXCEEDED);
}
