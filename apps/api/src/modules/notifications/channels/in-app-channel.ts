import { Types } from "mongoose";
import type { NotificationEventType } from "../notification-events.js";
import { NotificationModel } from "../notification-model.js";

/** What every channel delivers; validated by the notification service. */
export interface NotificationMessage {
	readonly type: NotificationEventType;
	readonly title: string;
	readonly body: string;
	/** Path inside the dashboard, e.g. `/projects/abc`. */
	readonly link?: string;
}

/** API shape of one in-app notification. */
export interface NotificationItem {
	readonly id: string;
	readonly type: string;
	readonly title: string;
	readonly body: string;
	readonly link: string | null;
	readonly readAt: string | null;
	readonly createdAt: string;
}

export interface NotificationPage {
	readonly items: NotificationItem[];
	readonly nextCursor: string | null;
	readonly unreadCount: number;
}

interface StoredNotification {
	_id: Types.ObjectId;
	type: string;
	title: string;
	body: string;
	link?: string | null;
	readAt?: Date | null;
	createdAt: Date;
}

function toItem(doc: StoredNotification): NotificationItem {
	return {
		id: doc._id.toHexString(),
		type: doc.type,
		title: doc.title,
		body: doc.body,
		link: doc.link ?? null,
		readAt: doc.readAt ? doc.readAt.toISOString() : null,
		createdAt: doc.createdAt.toISOString(),
	};
}

function objectIdOrNull(value: string): Types.ObjectId | null {
	return /^[a-f0-9]{24}$/.test(value) ? new Types.ObjectId(value) : null;
}

/** The in-app channel: always used, it is the record behind the bell. */
export async function storeInAppNotification(
	userSub: string,
	message: NotificationMessage,
): Promise<NotificationItem> {
	const created = await NotificationModel.create({ userSub, ...message });
	return toItem(created.toObject<StoredNotification>());
}

function countUnread(userSub: string): Promise<number> {
	return NotificationModel.countDocuments({ userSub, readAt: null });
}

/** Newest first; `cursor` is the id of the last item of the previous page. */
export async function listNotifications(
	userSub: string,
	page: { readonly cursor?: string; readonly limit: number },
): Promise<NotificationPage> {
	const before = page.cursor ? objectIdOrNull(page.cursor) : null;
	const docs = await NotificationModel.find({
		userSub,
		...(before ? { _id: { $lt: before } } : {}),
	})
		.sort({ _id: -1 })
		.limit(page.limit + 1)
		.lean<StoredNotification[]>();
	const hasMore = docs.length > page.limit;
	const items = docs.slice(0, page.limit).map(toItem);
	return {
		items,
		nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
		unreadCount: await countUnread(userSub),
	};
}

/** Marks one of the user's notifications read; `null` when it is not theirs. */
export async function markNotificationRead(
	userSub: string,
	notificationId: string,
): Promise<NotificationItem | null> {
	const _id = objectIdOrNull(notificationId);
	if (!_id) return null;
	await NotificationModel.updateOne(
		{ _id, userSub, readAt: null },
		{ $set: { readAt: new Date() } },
	);
	const doc = await NotificationModel.findOne({
		_id,
		userSub,
	}).lean<StoredNotification>();
	return doc ? toItem(doc) : null;
}

export async function markAllNotificationsRead(
	userSub: string,
): Promise<number> {
	const result = await NotificationModel.updateMany(
		{ userSub, readAt: null },
		{ $set: { readAt: new Date() } },
	);
	return result.modifiedCount;
}
