import { type InferRawDocType, Schema, model } from "mongoose";

// A short-lived browser<->CLI pairing session. The browser (served /login)
// shows `code`; the CLI claims it to receive an access token. TTL index
// auto-expires stale rows.
const deviceSessionSchema = new Schema(
	{
		code: { type: String, required: true, unique: true, index: true },
		status: {
			type: String,
			enum: ["pending", "claimed"],
			default: "pending",
		},
		expiresAt: { type: Date, required: true },
	},
	{ timestamps: { createdAt: true, updatedAt: false } },
);

// TTL cleanup — Mongo removes the doc once expiresAt passes.
deviceSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type DeviceSessionDocument = InferRawDocType<
	typeof deviceSessionSchema
> & { _id: Schema.Types.ObjectId };

export const DeviceSession = model("DeviceSession", deviceSessionSchema);
