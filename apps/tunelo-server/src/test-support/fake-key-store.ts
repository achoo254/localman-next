import { hashToken } from "../auth/token-hash.js";
import type { KeyInfo, KeyStore } from "../key-store/key-store-types.js";

/** In-memory KeyStore: register plaintext tokens with the info they map to. */
export class FakeKeyStore implements KeyStore {
	private readonly keys = new Map<string, KeyInfo>();

	add(token: string, info: Partial<KeyInfo> & Pick<KeyInfo, "kind">): KeyInfo {
		const keyHash = hashToken(token);
		const full: KeyInfo = {
			userId: `user-${this.keys.size}`,
			keyId: `key-${this.keys.size}`,
			keyHash,
			maxTunnels: 3,
			plan: "free",
			role: "user",
			scopes: [],
			...info,
		};
		this.keys.set(keyHash, full);
		return full;
	}

	async validate(keyHash: string): Promise<KeyInfo | null> {
		return this.keys.get(keyHash) ?? null;
	}
	async recordUsage(): Promise<void> {}
	async initialize(): Promise<void> {}
	async shutdown(): Promise<void> {}
}
