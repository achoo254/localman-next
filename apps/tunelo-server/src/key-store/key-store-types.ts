/**
 * - `idp`: identity-provider JWT, bound to an account (`ownerSub`).
 * - `legacy`: anonymous device token (`tunelo_…`, no scopes = full rights),
 *   accepted until `LEGACY_TOKEN_CUTOFF`.
 * - `link`: read-only token minted by `tunelo link` for one anonymous device.
 */
export type KeyKind = "idp" | "legacy" | "link";

export interface KeyInfo {
	kind: KeyKind;
	userId: string;
	keyId: string;
	keyHash: string;
	maxTunnels: number;
	/** Machine tunnels (background agents) the account may hold besides
	 *  `maxTunnels`; 0 or absent for tokens without an account. */
	maxMachineTunnels?: number;
	role: "user" | "admin";
	/** Granted scopes; empty for `legacy` (full rights, as before scopes). */
	scopes: string[];
	/** Account id (`sub`) for `idp` tokens. */
	ownerSub?: string;
	/** Machine the token was minted for (`legacy` device login). */
	deviceId?: string;
	/** Machine name recorded when the token was minted. */
	deviceName?: string;
	/** Device whose tunnels a `link` token may list. */
	linkedDeviceId?: string;
	/** Account owning `linkedDeviceId`, for a link an account minted for
	 *  its own machine (`POST /api/links/self`); absent for `tunelo link`. */
	linkedOwnerSub?: string;
}

export interface KeyStore {
	validate(keyHash: string): Promise<KeyInfo | null>;
	recordUsage(keyHash: string): Promise<void>;
	initialize(): Promise<void>;
	shutdown(): Promise<void>;
}
