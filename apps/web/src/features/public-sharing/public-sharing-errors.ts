import type { SourceMessages } from "../../i18n/message-types";
import type { Translate } from "../../i18n/translate";
import { ApiError, errorMessage } from "../../lib/api-client";

type ErrorKey =
	`publicSharing.errors.${keyof SourceMessages["publicSharing"]["errors"]}`;

/** Message keys of the API codes public sharing can meet. */
const KEYS: Readonly<Record<string, ErrorKey>> = {
	FORBIDDEN: "publicSharing.errors.forbidden",
	PUBLIC_LINKS_DISABLED: "publicSharing.errors.publicLinksDisabled",
	GUESTS_DISABLED: "publicSharing.errors.guestsDisabled",
	ACCESS_KEYS_DISABLED: "publicSharing.errors.accessKeysDisabled",
	ACCESS_KEY_LIMIT_REACHED: "publicSharing.errors.accessKeyLimit",
	RUN_BUTTON_LIMIT_REACHED: "publicSharing.errors.runButtonLimit",
	ENVIRONMENT_NOT_IN_WORKSPACE:
		"publicSharing.errors.environmentNotInWorkspace",
	PUBLIC_LINK_NOT_FOUND: "publicSharing.errors.linkNotFound",
	RUN_BUTTON_NOT_FOUND: "publicSharing.errors.runButtonNotFound",
	RATE_LIMITED: "publicSharing.errors.rateLimited",
	COLLECTION_LIMIT_REACHED: "publicSharing.errors.collectionLimit",
	COLLECTION_TOO_LARGE: "publicSharing.errors.collectionTooLarge",
	IMPORT_IN_PROGRESS: "publicSharing.errors.importInProgress",
	VALIDATION_ERROR: "publicSharing.errors.invalid",
	NOT_FOUND: "publicSharing.errors.notFound",
};

export function isRateLimited(error: unknown): boolean {
	return error instanceof ApiError && error.status === 429;
}

/**
 * Translated message for `error`: the mapped code, else the client's own
 * messages (network, bad response), else a generic fallback (API
 * messages are English only).
 */
export function publicSharingErrorMessage(
	error: unknown,
	t: Translate,
): string {
	if (!(error instanceof ApiError)) return errorMessage(error);
	const key = Object.hasOwn(KEYS, error.code) ? KEYS[error.code] : undefined;
	if (key) return t(key);
	return error.status === 0 ||
		error.code.startsWith("HTTP_") ||
		error.code === "INVALID_JSON"
		? errorMessage(error)
		: t("publicSharing.errors.fallback");
}

/**
 * Runs `action`; an API error comes out with its translated message, for
 * `ConfirmModal`, which shows `errorMessage(error)` itself.
 */
export async function withTranslatedError<T>(
	t: Translate,
	action: () => Promise<T>,
): Promise<T> {
	try {
		return await action();
	} catch (error) {
		if (!(error instanceof ApiError)) throw error;
		throw new ApiError(
			error.status,
			error.code,
			publicSharingErrorMessage(error, t),
			error.details,
		);
	}
}
