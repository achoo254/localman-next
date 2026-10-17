import mongoose, { Schema, type Types } from "mongoose";
import { tenantScopePlugin } from "../../tenancy/tenant-scope-plugin.js";

/** Pending and linked machines per user. */
export const MAX_TUNNEL_LINKS = 20;

export const TUNNEL_LINK_STATUSES = ["pending", "linked"] as const;
export type TunnelLinkStatus = (typeof TUNNEL_LINK_STATUSES)[number];

/**
 * One `tunelo link` of a user (`tunelo_links`): an anonymous machine whose
 * tunnels Localman may list for that user.
 *
 * - `pending`: Tunelo opened the pairing (`POST /api/links/init`);
 *   `requestId` collects the token once the machine approves. The row
 *   expires with the pairing (TTL on `pendingUntil`).
 * - `linked`: `tokenSealed` is the machine's read-only link token, sealed
 *   with the session keyring (`TokenCipher`, associated data bound to the
 *   user and the row id: see `linkTokenSlot`). `linkId` is Tunelo's id.
 *
 * Neither `requestId` nor the token ever leaves the server.
 */
const tunnelLinkSchema = new Schema(
	{
		userSub: { type: String, required: true },
		status: { type: String, enum: [...TUNNEL_LINK_STATUSES], required: true },
		requestId: { type: String },
		pendingUntil: { type: Date },
		tokenSealed: { type: String },
		linkId: { type: String },
		/** Name the machine gave itself, learnt from its tunnel list. */
		deviceName: { type: String },
		linkedAt: { type: Date },
		/** Tunelo refused the token (revoked on the machine): not called again. */
		deadAt: { type: Date },
	},
	{ collection: "tunelo_links", timestamps: true, versionKey: false },
);

tunnelLinkSchema.index({ userSub: 1, createdAt: 1 });
// Pending pairings vanish with Tunelo's: linked rows have no `pendingUntil`.
tunnelLinkSchema.index({ pendingUntil: 1 }, { expireAfterSeconds: 0 });

tunnelLinkSchema.plugin(tenantScopePlugin);
export const TunnelLinkModel = mongoose.model("TunnelLink", tunnelLinkSchema);

export interface StoredTunnelLink {
	_id: Types.ObjectId;
	userSub: string;
	status: TunnelLinkStatus;
	requestId?: string | null;
	pendingUntil?: Date | null;
	tokenSealed?: string | null;
	linkId?: string | null;
	deviceName?: string | null;
	linkedAt?: Date | null;
	deadAt?: Date | null;
	createdAt?: Date;
}

/** Associated data of a sealed link token: its owner and its row. */
export function linkTokenSlot(userSub: string, rowId: string): string {
	return `tunelo-link:${userSub}:${rowId}`;
}
