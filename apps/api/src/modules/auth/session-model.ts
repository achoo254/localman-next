import mongoose, { Schema } from "mongoose";
import { tenantScopePlugin } from "../../tenancy/tenant-scope-plugin.js";

/**
 * A signed-in browser. `_id` is the SHA-256 of the cookie value, so a
 * database read never yields a usable cookie. `tokens` holds the access,
 * refresh and ID tokens as one AES-256-GCM blob (see token-cipher.ts).
 */
const sessionSchema = new Schema(
	{
		_id: { type: String, required: true },
		sub: { type: String, required: true, index: true },
		/** IdP session id (`sid`), the key of back-channel logout. */
		sid: { type: String, index: true },
		tokens: { type: String, required: true },
		accessTokenExpiresAt: { type: Date, required: true },
		/** Hard end of this session; MongoDB deletes it afterwards. */
		expiresAt: { type: Date, required: true, expires: 0 },
		/** Cross-process refresh lease; see session-refresher.ts. */
		refreshLockedUntil: { type: Date },
	},
	{ collection: "sessions", timestamps: true, versionKey: false },
);

sessionSchema.plugin(tenantScopePlugin);
export const SessionModel = mongoose.model("Session", sessionSchema);
