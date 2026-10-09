import { MAX_RESOURCE_DEPTH } from "@localman/shared/constants";
import type { Translate } from "../../i18n/translate";
import { ApiError, errorMessage } from "../../lib/api-client";
import { isRecord } from "../../lib/json-guards";

/** `details` of a 400 VALIDATION_ERROR: `[{ path, message }]`. */
function firstIssuePath(details: unknown): string | null {
	if (!Array.isArray(details)) return null;
	const [first] = details;
	return isRecord(first) && typeof first.path === "string" && first.path
		? first.path
		: null;
}

function detailString(details: unknown, key: string): string | null {
	if (!isRecord(details)) return null;
	const value = details[key];
	return typeof value === "string" ? value : null;
}

/** 413 DATA_TOO_LARGE names the resource and the cap that was passed. */
function dataTooLarge(details: unknown, t: Translate): string {
	const name = detailString(details, "name");
	if (detailString(details, "limit") === "record") {
		return name
			? t("resources.errors.recordTooLargeOf", { name })
			: t("resources.errors.recordTooLarge");
	}
	return name
		? t("resources.errors.dataTooLargeOf", { name })
		: t("resources.errors.dataTooLarge");
}

/**
 * Sentence in the current language for an error of the resource API (the
 * API answers in English). Unknown codes fall back to `errorMessage`.
 */
export function resourceErrorMessage(error: unknown, t: Translate): string {
	if (!(error instanceof ApiError)) return errorMessage(error);
	switch (error.code) {
		case "VALIDATION_ERROR": {
			const path = firstIssuePath(error.details);
			return path
				? t("resources.errors.invalidAt", { path, message: error.message })
				: t("resources.errors.invalid");
		}
		case "TEMPLATE_TOO_LARGE":
			return t("resources.errors.templateTooLarge");
		case "NOT_FOUND":
			return t("resources.errors.notFound");
		case "PARENT_HAS_NO_DATA":
			return t("resources.errors.parentHasNoData");
		case "RESOURCE_NAME_TAKEN":
			return t("resources.errors.nameTaken");
		case "TREE_CYCLE":
			return t("resources.errors.treeCycle");
		case "TREE_TOO_DEEP":
			return t("resourceTree.refuse.tooDeep", { max: MAX_RESOURCE_DEPTH });
		case "FIELD_CONFLICT":
			return t("resources.errors.fieldConflict");
		case "PLAN_LIMIT_REACHED":
			return t("resources.errors.planLimit");
		case "DATA_TOO_LARGE":
			return dataTooLarge(error.details, t);
		case "FORBIDDEN":
			return t("resources.errors.forbidden");
		default:
			if (error.status === 413) return t("resources.errors.requestTooLarge");
			return errorMessage(error);
	}
}

/**
 * The same error with the translated sentence as its message, for
 * components that display `errorMessage(error)` (ConfirmModal).
 */
export function localizedError(error: unknown, t: Translate): unknown {
	return error instanceof ApiError
		? new ApiError(
				error.status,
				error.code,
				resourceErrorMessage(error, t),
				error.details,
			)
		: error;
}

/** Awaits `promise`, rejecting with `localizedError` of its failure. */
export async function localized<T>(
	promise: Promise<T>,
	t: Translate,
): Promise<T> {
	try {
		return await promise;
	} catch (error) {
		throw localizedError(error, t);
	}
}
