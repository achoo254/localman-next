/**
 * Translated text of import errors and warnings. The importers return
 * codes and params only (never input text), so every message is ours.
 */
import type {
	RequestImportError,
	RequestImportParams,
	RequestImportWarning,
} from "@localman/shared/api-client";
import type { Translate } from "../../../i18n/translate";

const text = (params: RequestImportParams, key: string): string =>
	String(params[key] ?? "");

const MIB = 1024 * 1024;

export function importErrorText(
	error: RequestImportError,
	t: Translate,
): string {
	const { params } = error;
	switch (error.code) {
		case "INPUT_TOO_LARGE": {
			const max = Number(params.max) || 10 * MIB;
			return t("apiClientTools.import.errors.INPUT_TOO_LARGE", {
				max: `${Math.round(max / MIB)} MB`,
			});
		}
		case "UNSUPPORTED_VERSION":
			return t("apiClientTools.import.errors.UNSUPPORTED_VERSION", {
				version: text(params, "version"),
			});
		case "INVALID_DOCUMENT":
			return t("apiClientTools.import.errors.INVALID_DOCUMENT", {
				path: text(params, "path") || "/",
			});
		case "EMPTY_INPUT":
		case "INVALID_JSON":
		case "YAML_NOT_SUPPORTED":
		case "UNKNOWN_FORMAT":
		case "INVALID_CURL":
		case "UNTERMINATED_QUOTE":
		case "TOO_COMPLEX":
			return t(`apiClientTools.import.errors.${error.code}`);
	}
}

export function importWarningText(
	warning: RequestImportWarning,
	t: Translate,
): string {
	const { params } = warning;
	switch (warning.code) {
		case "UNSUPPORTED_OPTION":
			return t("apiClientTools.import.warnings.UNSUPPORTED_OPTION", {
				option: text(params, "option"),
			});
		case "UNSUPPORTED_AUTH":
			return t("apiClientTools.import.warnings.UNSUPPORTED_AUTH", {
				type: text(params, "type"),
			});
		case "UNSUPPORTED_BODY":
			return t("apiClientTools.import.warnings.UNSUPPORTED_BODY", {
				mode: text(params, "mode"),
			});
		case "UNSUPPORTED_METHOD":
			return t("apiClientTools.import.warnings.UNSUPPORTED_METHOD", {
				method: text(params, "method"),
			});
		case "FILE_NOT_INCLUDED":
			return t("apiClientTools.import.warnings.FILE_NOT_INCLUDED", {
				name: text(params, "name"),
			});
		case "SCRIPT_REVIEW":
			return t("apiClientTools.import.warnings.SCRIPT_REVIEW");
		case "TRUNCATED":
			return t("apiClientTools.import.warnings.TRUNCATED", {
				max: text(params, "max"),
			});
		case "EXTRA_URLS":
			return t("apiClientTools.import.warnings.EXTRA_URLS", {
				count: text(params, "count"),
			});
		case "UNRESOLVED_REF":
			return t("apiClientTools.import.warnings.UNRESOLVED_REF", {
				ref: text(params, "ref"),
			});
		case "EXAMPLE_BODY_TRUNCATED":
			return t("apiClientTools.import.warnings.EXAMPLE_BODY_TRUNCATED");
		case "INVALID_METADATA":
			return text(params, "field") === "status"
				? t("apiClientTools.import.warnings.INVALID_METADATA.status")
				: t("apiClientTools.import.warnings.INVALID_METADATA.tags");
		case "TEXT_TRUNCATED":
			return t("apiClientTools.import.warnings.TEXT_TRUNCATED", {
				max: text(params, "max"),
			});
		case "MORE_WARNINGS":
			return t("apiClientTools.import.warnings.MORE_WARNINGS", {
				count: text(params, "count"),
			});
	}
}
