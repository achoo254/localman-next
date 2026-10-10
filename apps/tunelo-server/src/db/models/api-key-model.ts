import { type InferRawDocType, Schema, model } from "mongoose";

const apiKeySchema = new Schema(
	{
		// No user accounts — a key is a standalone access token. userId kept
		// optional for backward compat with any legacy rows; not required.
		userId: {
			type: Schema.Types.ObjectId,
			required: false,
			default: null,
			index: true,
		},
		keyHash: { type: String, required: true, unique: true, index: true },
		keyPrefix: { type: String, required: true },
		label: { type: String, default: "Default" },
		// Set for tokens minted via device login; lets a device keep one token
		// (re-login revokes prior full-rights tokens for the same deviceId).
		deviceId: { type: String, default: null, index: true },
		// Empty (or missing on rows older than scopes) = anonymous token with
		// full rights. `['tunnels:read']` = link token: it only lists the
		// tunnels of `linkedDeviceId` and can never open one.
		scopes: { type: [String], default: [] },
		linkedDeviceId: { type: String, default: null, index: true },
		// Who holds a link token (e.g. "Localman"), shown in `tunelo links`.
		clientName: { type: String, default: "" },
		status: { type: String, enum: ["active", "revoked"], default: "active" },
		maxTunnels: { type: Number, default: 3 },
		expiresAt: { type: Date, default: null },
		lastUsedAt: { type: Date, default: null },
	},
	{ timestamps: { createdAt: true, updatedAt: false } },
);

export type ApiKeyDocument = InferRawDocType<typeof apiKeySchema> & {
	_id: Schema.Types.ObjectId;
};

export const ApiKey = model("ApiKey", apiKeySchema);

/** Matches full-rights tokens only, including rows that predate `scopes`. */
export const FULL_RIGHTS_FILTER = {
	$or: [{ scopes: { $exists: false } }, { scopes: { $size: 0 } }],
};
