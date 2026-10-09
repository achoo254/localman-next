import mongoose, { Schema } from "mongoose";

/**
 * A Localman user, mirrored from the IdP claims at every sign-in and token
 * refresh. Credentials live only at the IdP: there is no password here.
 * `plan` belongs to Localman, not to the IdP.
 */
const userSchema = new Schema(
	{
		sub: { type: String, required: true, unique: true },
		username: { type: String, required: true },
		email: { type: String },
		emailVerified: { type: Boolean, required: true, default: false },
		name: { type: String },
		picture: { type: String },
		plan: {
			type: String,
			enum: ["free", "pro"],
			required: true,
			default: "free",
		},
		planExpiresAt: { type: Date },
		/** Linked chat from userinfo (`telegram` scope); absent when unlinked. */
		telegram: {
			chatId: { type: String },
			username: { type: String },
			/**
			 * Set when Localman's bot got 403 (the user never pressed Start or
			 * blocked it); cleared when the chat changes or the user retries.
			 */
			blockedAt: { type: Date },
			/**
			 * Set when the IdP reported a new link: the stored chat may be
			 * stale, so Telegram pauses until userinfo is read again.
			 */
			refreshPendingAt: { type: Date },
		},
	},
	{ collection: "users", timestamps: true, versionKey: false },
);

/**
 * Exact match ignoring case (`Alice` finds `alice`), never a prefix. The
 * `username` and `email` indexes use it, so lookups must pass the same
 * collation to be served by them.
 */
export const CASE_INSENSITIVE_COLLATION = {
	locale: "en",
	strength: 2,
} as const;

// Invite lookups by username or email (not unique: the IdP owns identity).
userSchema.index({ username: 1 }, { collation: CASE_INSENSITIVE_COLLATION });
userSchema.index({ email: 1 }, { collation: CASE_INSENSITIVE_COLLATION });

export const UserModel = mongoose.model("User", userSchema);
