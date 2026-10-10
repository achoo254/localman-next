import type {
	ElementRole,
	ShareableElementType,
} from "@localman/shared/access";
import { useQuery } from "@tanstack/react-query";
import type { Translate } from "../../i18n/translate";
import {
	type ElementShare,
	fetchElement,
	fetchElementAccess,
} from "./sharing-api";

export const elementKey = (type: ShareableElementType, id: string) =>
	["elements", type, id] as const;
export const elementAccessKey = (type: ShareableElementType, id: string) =>
	[...elementKey(type, id), "access"] as const;

/** Summary of an element; 404 (no access) is an answer, not retried. */
export function useElement(
	type: ShareableElementType,
	id: string,
	enabled = true,
) {
	return useQuery({
		queryKey: elementKey(type, id),
		queryFn: () => fetchElement(type, id),
		enabled,
	});
}

export function useElementAccess(
	type: ShareableElementType,
	id: string,
	enabled = true,
) {
	return useQuery({
		queryKey: elementAccessKey(type, id),
		queryFn: () => fetchElementAccess(type, id),
		enabled,
	});
}

export const ELEMENT_ROLE_CHOICES: readonly ElementRole[] = [
	"viewer",
	"editor",
];

export function elementRoleLabel(role: ElementRole, t: Translate): string {
	return t(`sharing.roles.${role}`);
}

/**
 * Name of a share: the account's name, its username, or the email. People
 * who cannot manage roles do not see emails, so an email share without an
 * account gets a neutral label.
 */
export function shareName(share: ElementShare, t: Translate): string {
	if (share.name) return share.name;
	if (share.username) return `@${share.username}`;
	return share.email ?? t("sharing.access.emailHidden");
}
