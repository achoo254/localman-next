import mongoose, { Schema, type Types } from "mongoose";
import { tenantScopePlugin } from "../../tenancy/tenant-scope-plugin.js";

/**
 * Only `linked` rows are written. Rows of the retired code pairing could
 * be `pending`; the TTL index on `pendingUntil` already in the database
 * removes the last of them, and every read filters on `linked`.
 */
export const TUNNEL_LINK_STATUSES = ["linked"] as const;

/**
 * `source` of the rows the retired own-machine links left behind (the
 * user's `tunelo` process linked itself so Localman could reach its
 * localhost). They stay in the database until a cleanup removes them;
 * Localman neither lists nor calls with them. Every other row is an anonymous machine linked
 * with a code before that flow was retired.
 */
const RETIRED_SOURCE = "self";

/** Filter of the rows Localman lists, calls and revokes. */
export const LIVE_LINK = {
	status: "linked",
	source: { $ne: RETIRED_SOURCE },
} as const;

export type TunnelLinkStatus = (typeof TUNNEL_LINK_STATUSES)[number];

/**
 * One linked machine of a user (`tunelo_links`): a machine whose tunnels
 * Localman may list for that user. `tokenSealed` is the machine's link
 * token, sealed with the session keyring (`TokenCipher`, associated data
 * bound to the user and the row id: see `linkTokenSlot`). `linkId` is
 * Tunelo's id. The token never leaves the server.
 */
const tunnelLinkSchema = new Schema(
	{
		userSub: { type: String, required: true },
		status: { type: String, enum: [...TUNNEL_LINK_STATUSES], required: true },
		tokenSealed: { type: String },
		linkId: { type: String },
		/** Name the machine gave itself, learnt from its tunnel list. */
		deviceName: { type: String },
		linkedAt: { type: Date },
		/** Tunelo refused the token (revoked on the machine): not called again. */
		deadAt: { type: Date },
		source: { type: String },
	},
	{ collection: "tunelo_links", timestamps: true, versionKey: false },
);

tunnelLinkSchema.index({ userSub: 1, createdAt: 1 });
tunnelLinkSchema.plugin(tenantScopePlugin);
export const TunnelLinkModel = mongoose.model("TunnelLink", tunnelLinkSchema);

export interface StoredTunnelLink {
	_id: Types.ObjectId;
	userSub: string;
	status: TunnelLinkStatus;
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
