import type { Logger } from "../../logger.js";
import { CollaboratorModel } from "../collaborators/collaborator-model.js";
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
 * - `email.reclaimed`: another account proved the address, so this one no
 *   longer owns it (see `forgetReclaimedEmail`).
 * Events can arrive out of order; the actions are safe either way because
 * the next userinfo read restores the truth.
 */
export async function applyAuditEvent(
	event: AuditEvent,
	logger: Logger,
): Promise<void> {
	if (event.type === "email.reclaimed") {
		await forgetReclaimedEmail(event.sub);
		logger.info({ sub: event.sub }, "Email reclaimed by another account");
		return;
	}
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

/**
 * The account lost its email to another account that verified it: drop the
 * address from the mirror at once (userinfo would only fix it at the next
 * sign-in), and unbind the pending invitations that were bound to the
 * account because of that address. They stay addressed to the email, so
 * the verified owner of the address can still accept them; invitations
 * bound by username are untouched.
 */
async function forgetReclaimedEmail(sub: string): Promise<void> {
	await UserModel.updateOne(
		{ sub },
		{ $unset: { email: 1 }, $set: { emailVerified: false } },
	);
	await CollaboratorModel.updateMany(
		{ inviteeUserId: sub, status: "pending", inviteeEmail: { $exists: true } },
		{ $unset: { inviteeUserId: 1 } },
	);
}
