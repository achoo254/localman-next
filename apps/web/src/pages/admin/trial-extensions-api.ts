import {
	TRIAL_EXTENSION_STATUSES,
	type TrialExtensionStatus,
} from "@localman/shared/constants";
import type { Translate } from "../../i18n/translate";
import { ApiError, apiRequest, errorMessage } from "../../lib/api-client";
import {
	InvalidResponseError,
	type JsonRecord,
	expectArray,
	expectRecord,
	expectString,
	isRecord,
	optionalString,
} from "../../lib/json-guards";

const BASE = "/api/v1/admin/trial-extensions";

export type ExtensionFilter = "pending" | "all";

export interface TrialExtensionItem {
	id: string;
	user: { sub: string; username: string | null; name: string | null };
	reason: string;
	requestedAt: string;
	status: TrialExtensionStatus;
	/** End of the user's trial when listed; null if the API does not know. */
	trialEndsAt: string | null;
}

export interface TrialExtensionPage {
	items: TrialExtensionItem[];
	nextCursor: string | null;
}

function isExtensionStatus(value: string): value is TrialExtensionStatus {
	return TRIAL_EXTENSION_STATUSES.some((status) => status === value);
}

function parseItem(value: unknown): TrialExtensionItem {
	const data: JsonRecord = expectRecord(value, "trial extension");
	const user = expectRecord(data.user, "user");
	const status = expectString(data, "status");
	if (!isExtensionStatus(status)) throw new InvalidResponseError("status");
	return {
		id: expectString(data, "id"),
		user: {
			sub: expectString(user, "sub"),
			username: optionalString(user, "username"),
			name: optionalString(user, "name"),
		},
		reason: expectString(data, "reason"),
		requestedAt: expectString(data, "requestedAt"),
		status,
		trialEndsAt: optionalString(data, "trialEndsAt"),
	};
}

export async function fetchTrialExtensions(
	filter: ExtensionFilter,
	cursor: string | null,
): Promise<TrialExtensionPage> {
	const params = new URLSearchParams({ status: filter });
	if (cursor) params.set("cursor", cursor);
	const data = expectRecord(
		await apiRequest(`${BASE}?${params.toString()}`),
		"trial extension page",
	);
	return {
		items: expectArray(data, "items").map(parseItem),
		nextCursor: optionalString(data, "nextCursor"),
	};
}

export async function decideTrialExtension(
	id: string,
	decision: "approve" | "decline",
): Promise<void> {
	await apiRequest(`${BASE}/${encodeURIComponent(id)}/${decision}`, {
		method: "POST",
	});
}

/**
 * Extends any account's trial by `days`, without a request; resolves with
 * the new end of the user's Pro (null if the answer does not say).
 */
export async function extendUserTrial(
	sub: string,
	days: number,
): Promise<string | null> {
	const data = await apiRequest(
		`/api/v1/admin/users/${encodeURIComponent(sub)}/extend-trial`,
		{ method: "POST", body: { days } },
	);
	return isRecord(data) && typeof data.planExpiresAt === "string"
		? data.planExpiresAt
		: null;
}

/**
 * Plain-language refusal of an admin trial action. `subject` says what a
 * 404 lost: the extension request, or the account of a direct extension.
 */
export function adminTrialErrorMessage(
	error: unknown,
	t: Translate,
	subject: "request" | "user",
): string {
	if (!(error instanceof ApiError)) return errorMessage(error);
	if (error.code === "EXTENSION_DECIDED")
		return t("admin.trial.errors.decided");
	if (error.code === "PLAN_HAS_NO_EXPIRY") {
		return t("admin.trial.errors.noExpiry");
	}
	if (error.status === 404) {
		return subject === "request"
			? t("admin.trial.errors.requestNotFound")
			: t("admin.trial.errors.userNotFound");
	}
	return errorMessage(error);
}

/** Whether the list no longer matches the server after this refusal. */
export function isStaleRequestError(error: unknown): boolean {
	return (
		error instanceof ApiError &&
		(error.code === "EXTENSION_DECIDED" || error.status === 404)
	);
}

/** Name shown for the requester: display name, username, then sub. */
export function requesterLabel(item: TrialExtensionItem): string {
	return item.user.name || item.user.username || item.user.sub;
}
