import mongoose, { Schema } from "mongoose";
import { NOTIFICATION_EVENT_TYPES } from "./notification-events.js";

/** In-app notifications are deleted this long after they were created. */
const NOTIFICATION_RETENTION_SECONDS = 90 * 24 * 60 * 60;
export const NOTIFICATION_TITLE_MAX = 200;
export const NOTIFICATION_BODY_MAX = 2000;

/** One in-app notification (the bell); every notification is stored here. */
const notificationSchema = new Schema(
	{
		userSub: { type: String, required: true },
		type: { type: String, enum: NOTIFICATION_EVENT_TYPES, required: true },
		title: { type: String, required: true, maxlength: NOTIFICATION_TITLE_MAX },
		body: { type: String, required: true, maxlength: NOTIFICATION_BODY_MAX },
		/** Path inside the dashboard, e.g. `/projects/abc`. */
		link: { type: String },
		readAt: { type: Date },
		createdAt: {
			type: Date,
			required: true,
			default: Date.now,
			expires: NOTIFICATION_RETENTION_SECONDS,
		},
	},
	{ collection: "notifications", versionKey: false },
);
// Newest first per user (cursor = _id), and the unread counter.
notificationSchema.index({ userSub: 1, _id: -1 });
notificationSchema.index({ userSub: 1, readAt: 1 });

export const NotificationModel = mongoose.model(
	"Notification",
	notificationSchema,
);
