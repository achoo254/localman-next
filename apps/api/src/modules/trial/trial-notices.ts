import { messagesFor } from "../../i18n/server-messages.js";
import { tenantSettings } from "../../tenancy/tenant-settings.js";
import { saigonDate } from "../../time/saigon-time.js";
import { alertOwnerThrottled } from "../feedback/owner-alert-throttle.js";
import { getNotificationService } from "../notifications/notification-runtime.js";

/** Where owners decide extension requests, and where users see their trial. */
export const ADMIN_TRIAL_LINK = "/admin/trial-extensions";
export const ACCOUNT_LINK = "/account";

export interface ExtensionRequester {
	readonly sub: string;
	readonly username: string;
	readonly name: string | null;
}

/**
 * Tells every owner about a new extension request: the bell (and Web
 * Push/Telegram per their settings) and the owner Telegram chat
 * (`OWNER_TELEGRAM_CHAT_ID`, throttled like the other owner alerts).
 * Only the requester's name goes out, never the reason. Runs after the
 * request is stored; failures are logged, never thrown.
 */
export async function notifyOwnersOfRequest(
	requester: ExtensionRequester,
	trialEndsAt: Date | null,
): Promise<void> {
	const user = requester.name?.trim() || requester.username;
	const service = getNotificationService();
	for (const owner of tenantSettings().ownerSubs) {
		service.notifyLater(owner, {
			type: "trial.extension.requested",
			params: { user },
			link: ADMIN_TRIAL_LINK,
		});
	}
	const endsOn = trialEndsAt ? saigonDate(trialEndsAt) : null;
	await alertOwnerThrottled("trial.extension", (locale) => {
		const { trial } = messagesFor(locale);
		return trial.ownerAlert({
			user,
			date: endsOn ? trial.formatDay(endsOn) : null,
		});
	});
}

/** The user's trial now ends at `endsAt` (approved request or direct extension). */
export function notifyExtended(sub: string, endsAt: Date): void {
	getNotificationService().notifyLater(sub, {
		type: "trial.extension.approved",
		params: { endsOn: saigonDate(endsAt) },
		link: ACCOUNT_LINK,
	});
}

export function notifyDeclined(sub: string): void {
	getNotificationService().notifyLater(sub, {
		type: "trial.extension.declined",
		params: {},
		link: ACCOUNT_LINK,
	});
}
