import type { Locale } from "@localman/shared";
import { Types } from "mongoose";
import type {
	NotificationType,
	ValidatedEvent,
} from "../notification-events.js";
import { NotificationModel } from "../notification-model.js";
import {
	type NotificationText,
	eventLabel,
	renderNotification,
} from "../notification-texts.js";

/** What Web Push and Telegram deliver: texts in the recipient's language. */
export interface NotificationMessage extends NotificationText {
	readonly type: NotificationType;
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
	params?: unknown;
	/** Only on records stored before notifications were translated. */
	title?: string | null;
	body?: string | null;
	link?: string | null;
	readAt?: Date | null;
	createdAt: Date;
}

/**
 * Rendered from `params` in the reader's language. Older records have no
 * `params` and keep the Vietnamese text they were stored with.
 */
function textOf(doc: StoredNotification, locale: Locale): NotificationText {
	return (
		renderNotification(doc.type, doc.params, locale) ?? {
			title: doc.title ?? eventLabel(doc.type, locale),
			body: doc.body ?? "",
		}
	);
}

function toItem(doc: StoredNotification, locale: Locale): NotificationItem {
	return {
		id: doc._id.toHexString(),
		type: doc.type,
		...textOf(doc, locale),
		link: doc.link ?? null,
		readAt: doc.readAt ? doc.readAt.toISOString() : null,
		createdAt: doc.createdAt.toISOString(),
	};
}

function objectIdOrNull(value: string): Types.ObjectId | null {
	return /^[a-f0-9]{24}$/.test(value) ? new Types.ObjectId(value) : null;
}

/**
 * The in-app channel: the record behind the bell. Stores the event's
 * params (never its texts) and returns the item rendered in `locale`.
 */
export async function storeInAppNotification(
	userSub: string,
	event: ValidatedEvent,
	locale: Locale,
): Promise<NotificationItem> {
	const created = await NotificationModel.create({
		userSub,
		type: event.type,
		params: event.params,
		link: event.link,
	});
	return toItem(created.toObject<StoredNotification>(), locale);
}

function countUnread(userSub: string): Promise<number> {
	return NotificationModel.countDocuments({ userSub, readAt: null });
}

/** Newest first; `cursor` is the id of the last item of the previous page. */
export async function listNotifications(
	userSub: string,
	page: { readonly cursor?: string; readonly limit: number },
	locale: Locale,
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
	const items = docs.slice(0, page.limit).map((doc) => toItem(doc, locale));
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
	locale: Locale,
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
	return doc ? toItem(doc, locale) : null;
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
