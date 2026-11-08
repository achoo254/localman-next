import { TUNNEL_REFUSAL_CODES, type TunnelKind } from "./shared/constants.js";

/** Refusals that retrying the same request cannot turn around. */
const FATAL_CODES: ReadonlySet<string> = new Set([
	"TUNELO_AUTH_003",
	"TUNELO_AUTH_004",
	TUNNEL_REFUSAL_CODES.SUBDOMAIN_HELD,
]);

/** The server refused the connection; `code` is its `TUNELO_*` code. */
export class TunnelAuthError extends Error {
	/** A refused token stays refused: no point reconnecting with it. */
	readonly fatal: boolean;
	constructor(
		message: string,
		public readonly code?: string,
	) {
		super(message);
		this.name = "TunnelAuthError";
		this.fatal = code !== undefined && FATAL_CODES.has(code);
	}
}

export function isFatal(err: unknown): boolean {
	return (
		typeof err === "object" &&
		err !== null &&
		"fatal" in err &&
		err.fatal === true
	);
}

/**
 * Whether the reconnect loop gives up on `err`. A machine tunnel also stops
 * on a full quota: unlike `tunelo http`, which waits for one of the user's
 * own tunnels to close, an agent should report it rather than retry forever.
 */
export function stopsReconnecting(
	err: unknown,
	kind: TunnelKind | undefined,
): boolean {
	if (isFatal(err)) return true;
	return (
		kind === "machine" &&
		err instanceof TunnelAuthError &&
		err.code === TUNNEL_REFUSAL_CODES.QUOTA_EXCEEDED
	);
}
