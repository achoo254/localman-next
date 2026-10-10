import type { SourceMessages } from "../../i18n/message-types";
import type { Translate } from "../../i18n/translate";
import { ApiError, errorMessage } from "../../lib/api-client";
import { isRecord } from "../../lib/json-guards";

type ErrorKey =
	`workspaces.errors.${keyof SourceMessages["workspaces"]["errors"]}`;

/** Message keys of the API codes the workspace screens can meet. */
const KEYS: Readonly<Record<string, ErrorKey>> = {
	INVITEE_NOT_FOUND: "workspaces.errors.inviteeNotFound",
	CANNOT_INVITE_SELF: "workspaces.errors.self",
	ALREADY_MEMBER: "workspaces.errors.alreadyMember",
	AMBIGUOUS_USERNAME: "workspaces.errors.ambiguousUsername",
	VALIDATION_ERROR: "workspaces.errors.invalid",
	RATE_LIMITED: "workspaces.errors.rateLimited",
	LAST_ADMIN: "workspaces.errors.lastAdmin",
	PERSONAL_WORKSPACE: "workspaces.errors.personal",
	FORBIDDEN: "workspaces.errors.forbidden",
	NOT_FOUND: "workspaces.errors.notFound",
};

/** The quota a 403 `PLAN_LIMIT_REACHED` names, if any. */
export function planLimitOf(
	error: unknown,
): "members" | "teamWorkspaces" | null {
	if (!(error instanceof ApiError) || error.code !== "PLAN_LIMIT_REACHED") {
		return null;
	}
	const limit = isRecord(error.details) ? error.details.limit : undefined;
	return limit === "teamWorkspaces" ? "teamWorkspaces" : "members";
}

/**
 * Translated message for `error`: the mapped code, else the client's own
 * messages (network, bad response). API messages are English only, so an
 * unmapped API code gets the generic fallback.
 */
export function workspaceErrorMessage(error: unknown, t: Translate): string {
	if (!(error instanceof ApiError)) return errorMessage(error);
	const limit = planLimitOf(error);
	if (limit === "members") return t("workspaces.errors.membersLimit");
	if (limit === "teamWorkspaces") return t("workspaces.errors.workspacesLimit");
	const key = Object.hasOwn(KEYS, error.code) ? KEYS[error.code] : undefined;
	if (key) return t(key);
	return error.status === 0 ||
		error.code.startsWith("HTTP_") ||
		error.code === "INVALID_JSON"
		? errorMessage(error)
		: t("workspaces.errors.fallback");
}

/**
 * The same error with a translated message, for components that show
 * `errorMessage(error)` themselves (`ConfirmModal`).
 */
export function translatedError(error: unknown, t: Translate): unknown {
	if (!(error instanceof ApiError)) return error;
	return new ApiError(
		error.status,
		error.code,
		workspaceErrorMessage(error, t),
		error.details,
	);
}
