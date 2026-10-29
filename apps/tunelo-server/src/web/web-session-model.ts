import { Schema, model } from "mongoose";
import { tenantScopePlugin } from "../tenancy/tunnel-tenant.js";

/**
 * A browser signed in to the web console. `_id` is the SHA-256 of the cookie
 * value, so a database read never yields a usable cookie. The refresh token
 * and the ID token (kept for the logout hint) are AES-256-GCM blobs bound to
 * `_id`. The access token itself is not kept: the console reads tunnels in
 * process and only uses refreshes to learn whether the grant still lives.
 */
const webSessionSchema = new Schema(
	{
		_id: { type: String, required: true },
		sub: { type: String, required: true, index: true },
		/** IdP session id, the key of back-channel logout. */
		sid: { type: String, default: null, index: true },
		profile: {
			username: { type: String, default: null },
			name: { type: String, default: null },
			email: { type: String, default: null },
			picture: { type: String, default: null },
		},
		refreshEnc: { type: String, default: null },
		idTokenEnc: { type: String, default: null },
		/** When the last access token expires: the next refresh is due then. */
		accessExp: { type: Date, required: true },
		loginAt: { type: Date, required: true },
		/** Hard end of the session; MongoDB deletes the row afterwards. */
		expiresAt: { type: Date, required: true },
	},
	{ collection: "web_sessions", versionKey: false },
);

webSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export interface StoredWebSession {
	_id: string;
	sub: string;
	sid: string | null;
	profile?: {
		username?: string | null;
		name?: string | null;
		email?: string | null;
		picture?: string | null;
	} | null;
	refreshEnc: string | null;
	idTokenEnc: string | null;
	accessExp: Date;
	loginAt: Date;
	expiresAt: Date;
}

webSessionSchema.plugin(tenantScopePlugin);
export const WebSessionModel = model("WebSession", webSessionSchema);
