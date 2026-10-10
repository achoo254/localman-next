import { SUPPORTED_LOCALES } from "@localman/shared";
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
		/**
		 * When the user started the one Pro trial of the account; absent
		 * until then. While it lasts `plan` is `pro` and `planExpiresAt`
		 * is the trial's end (`modules/trial/`).
		 */
		trialStartedAt: { type: Date },
		/**
		 * Trial reminders already sent, each holding the `planExpiresAt`
		 * it was sent for: an extension moves the end, so every reminder
		 * is due again for the new one.
		 */
		trialNotices: {
			ending7: { type: Date },
			ending1: { type: Date },
			ended: { type: Date },
		},
		/**
		 * Interface language chosen in the web app; notifications (in-app,
		 * Web Push, Telegram) use it. Absent until chosen: read as `en`.
		 */
		locale: { type: String, enum: [...SUPPORTED_LOCALES] },
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
// Trial reminders scan the trials ending soon or just ended.
userSchema.index(
	{ planExpiresAt: 1 },
	{ partialFilterExpression: { trialStartedAt: { $exists: true } } },
);

export const UserModel = mongoose.model("User", userSchema);
