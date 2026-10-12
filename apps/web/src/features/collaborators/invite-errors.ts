import type { SourceMessages } from "../../i18n/message-types";
import type { Translate } from "../../i18n/translate";
import { ApiError, errorMessage } from "../../lib/api-client";

/** Keys of the error texts (none takes a parameter). */
type ErrorKey =
	| `collaborators.errors.${keyof SourceMessages["collaborators"]["errors"]}`
	| `invite.errors.${keyof SourceMessages["invite"]["errors"]}`;

type ErrorKeys = Readonly<Record<string, ErrorKey>>;

/** Message keys of the invite dialog's lookup and invitation errors. */
const DIALOG_KEYS: ErrorKeys = {
	INVITEE_NOT_FOUND: "collaborators.errors.notFound",
	ALREADY_MEMBER: "collaborators.errors.alreadyMember",
	CANNOT_INVITE_SELF: "collaborators.errors.alreadyMember",
	AMBIGUOUS_USERNAME: "collaborators.errors.ambiguousUsername",
	VALIDATION_ERROR: "collaborators.errors.invalid",
	RATE_LIMITED: "collaborators.errors.rateLimited",
	CONFLICT: "collaborators.errors.conflict",
	PLAN_LIMIT_REACHED: "collaborators.errors.full",
};

/** Message keys of `/invite/:token` errors that are not a state of their own. */
const PAGE_KEYS: ErrorKeys = {
	RATE_LIMITED: "invite.errors.rateLimited",
	CONFLICT: "invite.errors.conflict",
};

/**
 * Translated message for `error`: the mapped code, else the client's own
 * messages (network, bad response). API messages are English only, so an
 * unmapped API code gets `fallback`.
 */
function messageFor(
	error: unknown,
	keys: ErrorKeys,
	fallback: ErrorKey,
	t: Translate,
): string {
	if (!(error instanceof ApiError)) return errorMessage(error);
	const mapped = Object.hasOwn(keys, error.code) ? keys[error.code] : undefined;
	if (mapped) return t(mapped);
	// Status 0 (no connection) and non-JSON answers come from the client.
	return error.status === 0 ||
		error.code.startsWith("HTTP_") ||
		error.code === "INVALID_JSON"
		? errorMessage(error)
		: t(fallback);
}

export function inviteErrorMessage(error: unknown, t: Translate): string {
	return messageFor(error, DIALOG_KEYS, "collaborators.errors.fallback", t);
}

export function invitePageErrorMessage(error: unknown, t: Translate): string {
	return messageFor(error, PAGE_KEYS, "invite.errors.fallback", t);
}

/** Loose shape check for the "no account yet, invite this email" path. */
export function looksLikeEmail(value: string): boolean {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
