import type { KeyInfo } from "./key-store/key-store-types.js";

/** Who a live tunnel belongs to, for `GET /api/tunnels`. */
export interface TunnelOwner {
	/** Account id for identity-provider tokens; null for anonymous ones. */
	ownerSub: string | null;
	/** Machine id. For anonymous tokens it comes from the stored token, so a
	 *  client cannot claim another machine's id. */
	deviceId: string | null;
	deviceName: string;
}

/** Machine details the CLI reports in its auth message (untrusted). */
export interface ClaimedDevice {
	deviceId?: string;
	deviceName?: string;
}

export function ownerOf(keyInfo: KeyInfo, claimed: ClaimedDevice): TunnelOwner {
	if (keyInfo.kind === "idp") {
		return {
			ownerSub: keyInfo.ownerSub ?? null,
			deviceId: claimed.deviceId ?? null,
			deviceName: claimed.deviceName ?? "",
		};
	}
	return {
		ownerSub: null,
		deviceId: keyInfo.deviceId ?? null,
		deviceName: claimed.deviceName ?? keyInfo.deviceName ?? "",
	};
}
