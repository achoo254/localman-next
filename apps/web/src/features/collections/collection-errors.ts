import type { SourceMessages } from "../../i18n/message-types";
import type { Translate } from "../../i18n/translate";
import { ApiError, errorMessage } from "../../lib/api-client";

type ErrorKey =
	`collections.errors.${keyof SourceMessages["collections"]["errors"]}`;

/** Message keys of the API codes the collection screens can meet. */
const KEYS: Readonly<Record<string, ErrorKey>> = {
	FORBIDDEN: "collections.errors.forbidden",
	NOT_FOUND: "collections.errors.notFound",
	NODE_NOT_FOUND: "collections.errors.notFound",
	TEAM_TO_PERSONAL: "collections.errors.teamToPersonal",
	WORKSPACE_MISSING: "collections.errors.workspaceMissing",
	SAME_WORKSPACE: "collections.errors.sameWorkspace",
	COLLECTION_LIMIT_REACHED: "collections.errors.collectionLimit",
	COLLECTION_NODES_LIMIT: "collections.errors.nodesLimit",
	COLLECTION_TOO_DEEP: "collections.errors.tooDeep",
	MOVE_CYCLE: "collections.errors.moveCycle",
	INVALID_ORDER: "collections.errors.moveFailed",
	INVALID_PARENT: "collections.errors.moveFailed",
	DRAFT_TOO_LARGE: "collections.errors.tooLarge",
	COLLECTION_TOO_LARGE: "collections.errors.tooLarge",
	PAYLOAD_TOO_LARGE: "collections.errors.tooLarge",
	CONFIRMATION_REQUIRED: "collections.errors.confirmation",
	VALIDATION_ERROR: "collections.errors.invalid",
	RATE_LIMITED: "collections.errors.rateLimited",
};

/**
 * Translated message for `error`: the mapped code, else the client's own
 * messages (network, bad response). API messages are English only, so an
 * unmapped API code gets the generic fallback.
 */
export function collectionErrorMessage(error: unknown, t: Translate): string {
	if (!(error instanceof ApiError)) return errorMessage(error);
	const key = Object.hasOwn(KEYS, error.code) ? KEYS[error.code] : undefined;
	if (key) return t(key);
	return error.status === 0 ||
		error.code.startsWith("HTTP_") ||
		error.code === "INVALID_JSON"
		? errorMessage(error)
		: t("collections.errors.fallback");
}

/** `error` carrying its message in the language on screen (for ConfirmModal). */
export function translatedError(error: unknown, t: Translate): unknown {
	if (!(error instanceof ApiError)) return error;
	const message = collectionErrorMessage(error, t);
	return new ApiError(error.status, error.code, message, error.details);
}
