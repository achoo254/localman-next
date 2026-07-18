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
