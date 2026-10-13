import { type InferRawDocType, Schema, model } from "mongoose";
import { tenantScopePlugin } from "../../tenancy/tunnel-tenant.js";

// A pending `tunelo link` pairing. A client (e.g. Localman) opens it and shows
// the user an `XXXX-XXXX` code; the anonymous machine approves it with that
// code; the client polls, and the poll that claims (deletes) the approved row
// mints the read-only link token. Only the code's hash is stored, never a
// token. A TTL index drops stale rows.
const linkRequestSchema = new Schema(
	{
		requestId: { type: String, required: true, unique: true, index: true },
		codeHash: { type: String, required: true, unique: true },
		clientName: { type: String, default: "" },
		status: {
			type: String,
			enum: ["pending", "approved"],
			default: "pending",
		},
		linkedDeviceId: { type: String, default: null },
		expiresAt: { type: Date, required: true },
	},
	{ timestamps: { createdAt: true, updatedAt: false } },
);

linkRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type LinkRequestDocument = InferRawDocType<typeof linkRequestSchema> & {
	_id: Schema.Types.ObjectId;
};

linkRequestSchema.plugin(tenantScopePlugin);
export const LinkRequest = model("LinkRequest", linkRequestSchema);
