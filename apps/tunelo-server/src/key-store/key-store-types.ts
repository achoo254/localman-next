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
	plan: string;
	role: "user" | "admin";
	/** Granted scopes; empty for `legacy` (full rights, as before scopes). */
	scopes: string[];
	/** Account id (`sub`) for `idp` tokens. */
	ownerSub?: string;
	/** Machine the token was minted for (`legacy` device login). */
	deviceId?: string;
	/** Machine name recorded when the token was minted. */
	deviceName?: string;
	/** Anonymous device whose tunnels a `link` token may list. */
	linkedDeviceId?: string;
}

export interface KeyStore {
	validate(keyHash: string): Promise<KeyInfo | null>;
	recordUsage(keyHash: string): Promise<void>;
	initialize(): Promise<void>;
	shutdown(): Promise<void>;
}
