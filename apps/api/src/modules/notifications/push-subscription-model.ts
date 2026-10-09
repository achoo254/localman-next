import mongoose, { Schema } from "mongoose";

/**
 * A browser's Web Push subscription (one per device and browser profile),
 * bound to the session that registered it: when that session ends
 * (logout, back-channel logout, expiry) the device stops receiving pushes.
 * The endpoint is unique: re-subscribing the same browser under another
 * account or session moves it there.
 */
const pushSubscriptionSchema = new Schema(
	{
		userSub: { type: String, required: true, index: true },
		sessionId: { type: String, required: true, index: true },
		endpoint: { type: String, required: true, unique: true },
		keys: {
			p256dh: { type: String, required: true },
			auth: { type: String, required: true },
		},
		expirationTime: { type: Date },
	},
	{ collection: "push_subscriptions", timestamps: true, versionKey: false },
);

export const PushSubscriptionModel = mongoose.model(
	"PushSubscription",
	pushSubscriptionSchema,
);

/** Drops the devices registered by sessions that have ended. */
export async function deletePushSubscriptionsOfSessions(
	sessionIds: readonly string[],
): Promise<void> {
	await PushSubscriptionModel.deleteMany({ sessionId: { $in: sessionIds } });
}
