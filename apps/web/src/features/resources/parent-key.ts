import {
	OBJECT_ID_FIELD,
	PARENT_KEY_MAX,
	PARENT_KEY_PATTERN,
	parentKeyIssue,
} from "@localman/shared/constants";
import type { Translate } from "../../i18n/translate";
import { ApiError } from "../../lib/api-client";
import { isRecord } from "../../lib/json-guards";
import { parseJsonText } from "../../lib/json-text";
import type { FormPlace, ResourceDraft } from "./resource-form-state";

/**
 * Why `key` cannot name the parent id field of a record that already has
 * `takenNames`, or undefined when it can. The shared rule of the API
 * (`parentKeyIssue`) decides; the checks before it only pick the message
 * in the user's language.
 */
export function parentKeyError(
	key: string,
	takenNames: readonly string[],
	t: Translate,
): string | undefined {
	if (key === "") return t("resources.validation.parentKeyRequired");
	if (key.length > PARENT_KEY_MAX) {
		return t("resources.validation.parentKeyTooLong", { max: PARENT_KEY_MAX });
	}
	if (!PARENT_KEY_PATTERN.test(key)) {
		return t("resources.validation.parentKeyPattern");
	}
	if (key === OBJECT_ID_FIELD) return t("resources.validation.parentKeyId");
	if (parentKeyIssue(key) !== null) {
		return t("resources.validation.fieldForbidden", { name: key });
	}
	if (takenNames.includes(key)) {
		return t("resources.validation.parentKeyTaken", { name: key });
	}
	return undefined;
}

/**
 * Names a record of the draft already uses: its schema fields and the
 * top-level keys of its object template (the API refuses both as key).
 */
export function takenNamesOf(draft: ResourceDraft): string[] {
	const names = draft.fields.map((field) => field.name.trim());
	const parsed = parseJsonText(draft.template);
	if (draft.template.trim() === "" || !parsed.ok || !isRecord(parsed.value)) {
		return names;
	}
	return [...names, ...Object.keys(parsed.value)];
}

/**
 * The message for the Parent key field when the API refused a changed key
 * (400 VALIDATION_ERROR with an issue on `parentKey`, or 409 FIELD_CONFLICT
 * because stored records already hold that field), else null. The
 * client's own check names the reason in the user's language when it can.
 */
export function serverParentKeyError(
	error: unknown,
	key: string,
	takenNames: readonly string[],
	t: Translate,
): string | null {
	if (!(error instanceof ApiError)) return null;
	if (error.code === "FIELD_CONFLICT") {
		return t("resources.validation.parentKeyInData", { name: key });
	}
	if (error.code !== "VALIDATION_ERROR") return null;
	const issues = Array.isArray(error.details) ? error.details : [error.details];
	const blamed = issues.some(
		(issue) => isRecord(issue) && issue.path === "parentKey",
	);
	if (!blamed) return null;
	return (
		parentKeyError(key, takenNames, t) ??
		t("resources.validation.parentKeyRefused")
	);
}

/**
 * The parent key to send: only a nested resource's, and only once the user
 * changed it, so a resource keeping an older key that is not a plain
 * identifier can still be saved.
 */
export function changedParentKey(
	draft: ResourceDraft,
	place: FormPlace,
): string | null {
	if (place.parentKey === null) return null;
	const key = draft.parentKey.trim();
	return key === place.parentKey ? null : key;
}
