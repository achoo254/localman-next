import type { Translator } from "../../i18n/translate";
import type { Collaborator } from "./collaborators-api";

/** `Minh Anh · @minhanh`, or `@minhanh` without a display name. */
export function personLabel(person: {
	name: string | null;
	username: string;
}): string {
	return person.name
		? `${person.name} · @${person.username}`
		: `@${person.username}`;
}

/** Text and dates of the current language, for the labels below. */
export type LabelI18n = Pick<Translator, "t" | "formatDate">;

export function collaboratorLabel(
	item: Collaborator,
	{ t, formatDate }: LabelI18n,
): string {
	const date = item.expiresAt ? formatDate(item.expiresAt) : "";
	const expired = item.status === "expired";
	if (item.user) {
		const person = personLabel(item.user);
		return expired
			? t("collaborators.row.personExpired", { person, date })
			: person;
	}
	const email = item.inviteeEmail ?? t("collaborators.row.emailHidden");
	return expired
		? t("collaborators.row.linkExpired", { email, date })
		: t("collaborators.row.linkPending", { email, date });
}

/** Accessible name of the X button: what pressing it does, and to whom. */
export function removeLabel(item: Collaborator, i18n: LabelI18n): string {
	const label = collaboratorLabel(item, i18n);
	if (item.status === "accepted") {
		return i18n.t("collaborators.row.remove", { label });
	}
	if (item.status === "pending") {
		return i18n.t("collaborators.row.cancelInvite", { label });
	}
	return i18n.t("collaborators.row.deleteInvite", { label });
}

export function rowDataId(item: Collaborator): string {
	return item.user
		? `collaborator-${item.user.username}`
		: `collaborator-link-${item.id}`;
}

/** Short name for confirmations: display name, @username or the email. */
export function memberName(item: Collaborator, i18n: LabelI18n): string {
	if (item.user) return item.user.name || `@${item.user.username}`;
	return item.inviteeEmail ?? collaboratorLabel(item, i18n);
}
