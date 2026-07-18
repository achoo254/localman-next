import { type InferRawDocType, Schema, model } from "mongoose";

// A short-lived device-login request. The CLI creates it (init) with its
// deviceId; the browser approves it; the CLI polls to retrieve the token.
// `issuedToken` holds the plaintext only between approve and the CLI's poll,
// then is cleared. A TTL index auto-expires stale rows.
const loginRequestSchema = new Schema(
	{
		requestId: { type: String, required: true, unique: true, index: true },
		deviceId: { type: String, required: true },
		deviceName: { type: String, default: "" },
		status: {
			type: String,
			enum: ["pending", "approved"],
			default: "pending",
		},
		issuedToken: { type: String, default: null },
		expiresAt: { type: Date, required: true },
	},
	{ timestamps: { createdAt: true, updatedAt: false } },
);

loginRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type LoginRequestDocument = InferRawDocType<
	typeof loginRequestSchema
> & { _id: Schema.Types.ObjectId };

export const LoginRequest = model("LoginRequest", loginRequestSchema);
