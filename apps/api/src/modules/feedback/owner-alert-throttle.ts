import type { Locale } from "@localman/shared";
import { runtimeSettings } from "../../config/runtime-settings.js";
import { messagesFor } from "../../i18n/server-messages.js";
import {
	RateLimitWindowModel,
	takeRateLimitSlot,
} from "../../lib/rate-limit-windows.js";
import { getNotificationService } from "../notifications/notification-runtime.js";

/** Suppressed alerts are remembered this long while waiting for a slot. */
const PENDING_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const pendingId = (kind: string) => `owner-alert-pending:${kind}`;

async function addPending(kind: string, now: Date): Promise<void> {
	await RateLimitWindowModel.updateOne(
		{ _id: pendingId(kind) },
		{
			$inc: { hits: 1 },
			$set: { expiresAt: new Date(now.getTime() + PENDING_TTL_MS) },
		},
		{ upsert: true },
	);
}

/** Reads and clears the number of alerts suppressed so far. */
async function takePending(kind: string): Promise<number> {
	const before = await RateLimitWindowModel.findOneAndUpdate(
		{ _id: pendingId(kind) },
		{ $set: { hits: 0 } },
		{ returnDocument: "before" },
	).lean<{ hits: number }>();
	return before?.hits ?? 0;
}

/**
 * Sends an owner alert unless this kind already used its quota for the
 * window (`ownerAlertLimit`, e.g. 10 per hour), so a spam burst cannot
 * flood the owner's Telegram. Suppressed alerts are counted and summarized
 * ("and X more") in the next alert that goes through; the entries
 * themselves are all on the admin page. `text` writes the alert in the
 * owner's language.
 */
export async function alertOwnerThrottled(
	kind: string,
	text: (locale: Locale) => string,
	now: Date = new Date(),
): Promise<void> {
	const allowed = await takeRateLimitSlot(
		`owner-alert:${kind}`,
		"owner",
		runtimeSettings().ownerAlertLimit,
		now,
	);
	if (!allowed) {
		await addPending(kind, now);
		return;
	}
	const pending = await takePending(kind);
	getNotificationService().alertOwner((locale) => {
		const alert = text(locale);
		if (pending === 0) return alert;
		return `${alert}\n\n${messagesFor(locale).ownerAlerts.suppressed(pending)}`;
	}, kind);
}
