import type { SourceMessages } from "../../i18n/message-types";
import type { Translate } from "../../i18n/translate";
import { ApiError, errorMessage } from "../../lib/api-client";

type ErrorKey = `sharing.errors.${keyof SourceMessages["sharing"]["errors"]}`;

/** Message keys of the API codes the sharing screens can meet. */
const KEYS: Readonly<Record<string, ErrorKey>> = {
	PERSONAL_WORKSPACE: "sharing.errors.personal",
	WORKSPACE_MISSING: "sharing.errors.workspaceMissing",
	CANNOT_SHARE_SELF: "sharing.errors.self",
	INVITEE_NOT_FOUND: "sharing.errors.inviteeNotFound",
	AMBIGUOUS_USERNAME: "sharing.errors.ambiguousUsername",
	VALIDATION_ERROR: "sharing.errors.invalid",
	RATE_LIMITED: "sharing.errors.rateLimited",
	FORBIDDEN: "sharing.errors.forbidden",
	NOT_FOUND: "sharing.errors.notFound",
	ALREADY_HAS_ACCESS: "sharing.errors.alreadyHasAccess",
	REQUEST_CHANGED: "sharing.errors.requestChanged",
	ALREADY_RESOLVED: "sharing.errors.alreadyResolved",
};

export function errorCodeOf(error: unknown): string | null {
	return error instanceof ApiError ? error.code : null;
}

export function isNotFound(error: unknown): boolean {
	return error instanceof ApiError && error.status === 404;
}

/**
 * Translated message for `error`: the mapped code, else the client's own
 * messages (network, bad response). API messages are English only, so an
 * unmapped API code gets the generic fallback.
 */
export function sharingErrorMessage(error: unknown, t: Translate): string {
	if (!(error instanceof ApiError)) return errorMessage(error);
	const key = Object.hasOwn(KEYS, error.code) ? KEYS[error.code] : undefined;
	if (key) return t(key);
	return error.status === 0 ||
		error.code.startsWith("HTTP_") ||
		error.code === "INVALID_JSON"
		? errorMessage(error)
		: t("sharing.errors.fallback");
}
