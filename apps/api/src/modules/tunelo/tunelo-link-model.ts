import mongoose, { Schema, type Types } from "mongoose";
import { tenantScopePlugin } from "../../tenancy/tenant-scope-plugin.js";

/** Linked machines per user. */
export const MAX_TUNNEL_LINKS = 20;

/**
 * Only `linked` rows are written. Rows of the retired code pairing could
 * be `pending`; the TTL index on `pendingUntil` already in the database
 * removes the last of them, and every read filters on `linked`.
 */
export const TUNNEL_LINK_STATUSES = ["linked"] as const;

/**
 * How the machine was linked: `self` (the `tunelo` process of the user's
 * own account after `tunelo login`, `POST /tunelo/links/self`), which may
 * also forward to the machine's localhost, or `pairing` (an anonymous
 * machine linked with a code before that flow was retired; such rows stay
 * until the user removes them).
 */
export const TUNNEL_LINK_SOURCES = ["pairing", "self"] as const;
export type TunnelLinkSource = (typeof TUNNEL_LINK_SOURCES)[number];
export type TunnelLinkStatus = (typeof TUNNEL_LINK_STATUSES)[number];

/**
 * One linked machine of a user (`tunelo_links`): a machine whose tunnels
 * Localman may list for that user. `tokenSealed` is the machine's link
 * token, sealed with the session keyring (`TokenCipher`, associated data
 * bound to the user and the row id: see `linkTokenSlot`). `linkId` is
 * Tunelo's id.
 *
 * A `self` row also keeps the machine (`machineId`, `machineName` as the
 * process reported them, `deviceId` as Tunelo vouched for it), where its
 * localhost is reached (`forwardUrl`) and whether the user lets Localman
 * send there (`forwardEnabled`). Rows without `source` are pairings.
 *
 * The token never leaves the server.
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
		source: { type: String, enum: [...TUNNEL_LINK_SOURCES] },
		machineId: { type: String },
		machineName: { type: String },
		deviceId: { type: String },
		forwardUrl: { type: String },
		forwardEnabled: { type: Boolean },
	},
	{ collection: "tunelo_links", timestamps: true, versionKey: false },
);

tunnelLinkSchema.index({ userSub: 1, createdAt: 1 });
// One row per own machine of the user (a new `tunelo login` replaces it),
// even when two links race. `deviceId` is the machine key Tunelo vouched
// for (`tunelo.<machineId>`), not the id the process reports.
tunnelLinkSchema.index(
	{ userSub: 1, deviceId: 1 },
	{
		unique: true,
		name: "own_machine",
		partialFilterExpression: { source: "self" },
	},
);
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
	source?: TunnelLinkSource | null;
	machineId?: string | null;
	machineName?: string | null;
	deviceId?: string | null;
	forwardUrl?: string | null;
	forwardEnabled?: boolean | null;
	createdAt?: Date;
}

/** Associated data of a sealed link token: its owner and its row. */
export function linkTokenSlot(userSub: string, rowId: string): string {
	return `tunelo-link:${userSub}:${rowId}`;
}
