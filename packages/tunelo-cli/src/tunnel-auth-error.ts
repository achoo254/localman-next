/** The server refused the token; `code` is its `TUNELO_*` code. */
export class TunnelAuthError extends Error {
	/** A refused token stays refused: no point reconnecting with it. */
	readonly fatal: boolean;
	constructor(
		message: string,
		public readonly code?: string,
	) {
		super(message);
		this.name = "TunnelAuthError";
		this.fatal = code === "TUNELO_AUTH_003" || code === "TUNELO_AUTH_004";
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
