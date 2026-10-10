import type { Translate } from "../../i18n/translate";
import { ApiError, apiRequest, errorMessage } from "../../lib/api-client";
import { type CurrentUser, parseCurrentUser } from "../auth/current-user";

const TRIAL_PATH = "/api/v1/users/me/trial";

/** Starts the one Pro trial of the account; resolves with the new `me`. */
export async function startTrial(): Promise<CurrentUser> {
	return parseCurrentUser(await apiRequest(TRIAL_PATH, { method: "POST" }));
}

/** Asks the owner for more trial time; resolves with the new `me`. */
export async function requestTrialExtension(
	reason: string,
): Promise<CurrentUser> {
	return parseCurrentUser(
		await apiRequest(`${TRIAL_PATH}/extension`, {
			method: "POST",
			body: { reason },
		}),
	);
}

/** Refusals of the trial routes that deserve their own explanation. */
const TRIAL_ERRORS = {
	TRIAL_ALREADY_USED: "trial.errors.alreadyUsed",
	ALREADY_PRO: "trial.errors.alreadyPro",
	EXTENSION_PENDING: "trial.errors.extensionPending",
	TRIAL_NOT_EXTENDABLE: "trial.errors.notExtendable",
} as const;

function isTrialErrorCode(code: string): code is keyof typeof TRIAL_ERRORS {
	return Object.hasOwn(TRIAL_ERRORS, code);
}

/**
 * Plain-language message for a failed trial request, or the generic API
 * message when the refusal is not specific to the trial.
 */
export function trialErrorMessage(error: unknown, t: Translate): string {
	if (error instanceof ApiError && isTrialErrorCode(error.code)) {
		return t(TRIAL_ERRORS[error.code]);
	}
	return errorMessage(error);
}

/** Codes after which the cached `me` is stale and worth refetching. */
export function isTrialStateConflict(error: unknown): boolean {
	return error instanceof ApiError && isTrialErrorCode(error.code);
}

/**
 * Message for a refused extension request: the trial refusals above, the
 * daily request cap (429) and a reason the server would not take (400).
 */
export function extensionErrorMessage(error: unknown, t: Translate): string {
	if (error instanceof ApiError && error.code === "RATE_LIMITED") {
		return t("trial.errors.extensionRateLimited");
	}
	if (error instanceof ApiError && error.status === 400) {
		return t("trial.errors.invalidReason");
	}
	return trialErrorMessage(error, t);
}
