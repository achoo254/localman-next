/**
 * Title and next step for a failed send, in the language on screen. Proxy
 * and network codes get their own advice; anything else (prepare and
 * script errors, which the workbench already words) keeps its message.
 * Reads the API's `details` defensively: the client never validated it.
 */
import { MAX_REDIRECTS } from "@localman/shared/api-client";
import type { Translate } from "../../../i18n/translate";
import { isRecord } from "../../../lib/json-guards";
import type { SendFailure } from "../workbench/workbench-types";

export type ResponseFailure = Pick<SendFailure, "code" | "message" | "details">;

export interface FailureCopy {
	title: string;
	hint: string;
}

function detail(failure: ResponseFailure, key: string): unknown {
	return isRecord(failure.details) ? failure.details[key] : undefined;
}

export function describeFailure(
	failure: ResponseFailure,
	t: Translate,
): FailureCopy {
	switch (failure.code) {
		case "PROXY_TARGET_BLOCKED":
			return detail(failure, "reason") === "port"
				? {
						title: t("apiClientTools.errors.portBlocked.title"),
						hint: t("apiClientTools.errors.portBlocked.hint"),
					}
				: {
						title: t("apiClientTools.errors.targetBlocked.title"),
						hint: t("apiClientTools.errors.targetBlocked.hint"),
					};
		case "PROXY_DNS_FAILED":
			return {
				title: t("apiClientTools.errors.dnsFailed.title"),
				hint: t("apiClientTools.errors.dnsFailed.hint"),
			};
		case "PROXY_TIMEOUT": {
			const ms = detail(failure, "timeoutMs");
			const seconds = typeof ms === "number" ? Math.round(ms / 1000) : 30;
			return {
				title: t("apiClientTools.errors.timeout.title"),
				hint: t("apiClientTools.errors.timeout.hint", { seconds }),
			};
		}
		case "PROXY_TOO_MANY_REDIRECTS":
			return {
				title: t("apiClientTools.errors.tooManyRedirects.title"),
				hint: t("apiClientTools.errors.tooManyRedirects.hint", {
					max: MAX_REDIRECTS,
				}),
			};
		case "PROXY_CONNECTION_FAILED":
			return {
				title: t("apiClientTools.errors.connectionFailed.title"),
				hint: t("apiClientTools.errors.connectionFailed.hint"),
			};
		case "PROXY_BUSY":
			return {
				title: t("apiClientTools.errors.proxyBusy.title"),
				hint: t("apiClientTools.errors.proxyBusy.hint"),
			};
		case "RATE_LIMITED":
			return {
				title: t("apiClientTools.errors.rateLimited.title"),
				hint: t("apiClientTools.errors.rateLimited.hint"),
			};
		case "MONTHLY_QUOTA_EXCEEDED":
			return {
				title: t("apiClientTools.errors.quotaExceeded.title"),
				hint: t("apiClientTools.errors.quotaExceeded.hint"),
			};
		case "NETWORK_ERROR":
			return {
				title: t("apiClientTools.errors.network.title"),
				hint: t("apiClientTools.errors.network.hint"),
			};
		case "UNAUTHENTICATED":
			return {
				title: t("apiClientTools.errors.unauthenticated.title"),
				hint: t("apiClientTools.errors.unauthenticated.hint"),
			};
		default:
			return {
				title: t("apiClientTools.errors.unknown.title"),
				hint: t("apiClientTools.errors.unknown.hint", {
					message: failure.message || t("common.errors.server"),
				}),
			};
	}
}
