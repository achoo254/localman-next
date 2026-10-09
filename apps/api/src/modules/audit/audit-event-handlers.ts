import type { Logger } from "../../logger.js";
import { UserModel } from "../users/user-model.js";
import type { AuditEvent } from "./security-event-token.js";

/**
 * Applies what Localman acts on today; every other event is only recorded.
 * - `method.unlinked` telegram: the chat is gone at the IdP, forget it now
 *   so nothing more is sent there.
 * - `method.linked` telegram: the user linked a (possibly different) chat.
 *   The chat id only comes from userinfo, so Telegram is paused for this
 *   user until the next sign-in or token refresh re-reads it; the old chat
 *   gets nothing meanwhile.
 * Events can arrive out of order; both actions are safe either way because
 * the next userinfo read restores the truth.
 */
export async function applyAuditEvent(
	event: AuditEvent,
	logger: Logger,
): Promise<void> {
	const method = event.data.method;
	if (method !== "telegram") return;
	if (event.type === "method.unlinked") {
		await UserModel.updateOne({ sub: event.sub }, { $unset: { telegram: 1 } });
		logger.info({ sub: event.sub }, "Telegram chat unlinked at the IdP");
		return;
	}
	if (event.type === "method.linked") {
		await UserModel.updateOne(
			{ sub: event.sub },
			{ $set: { "telegram.refreshPendingAt": new Date() } },
		);
		logger.info({ sub: event.sub }, "Telegram chat relinked at the IdP");
	}
}
