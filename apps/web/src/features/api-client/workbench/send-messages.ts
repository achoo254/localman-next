/**
 * Text of the errors a send can stop on before reaching the network, in
 * the language on screen. Plain functions (the sender runs outside React),
 * so they read the active translator.
 */
import type { RequestPrepareError } from "@localman/shared/api-client";
import type { ScriptError } from "@localman/shared/api-client/script-sandbox";
import { activeTranslator } from "../../../i18n/active-translator";

export function prepareErrorMessage(error: RequestPrepareError): string {
	const { t } = activeTranslator();
	const name = error.subject ?? "";
	switch (error.code) {
		case "INVALID_URL":
			return t("apiClient.send.prepare.invalidUrl");
		case "INVALID_HEADER_NAME":
			return t("apiClient.send.prepare.invalidHeaderName", { name });
		case "INVALID_HEADER_VALUE":
			return t("apiClient.send.prepare.invalidHeaderValue", { name });
		case "FILE_MISSING":
			return t("apiClient.send.prepare.fileMissing", { name });
		case "BODY_TOO_LARGE":
			return t("apiClient.send.prepare.bodyTooLarge");
	}
}

/** What went wrong in a script, with the line when the engine gave one. */
export function scriptErrorMessage(error: ScriptError): string {
	const { t } = activeTranslator();
	const reason = t(`apiClient.send.script.${error.code}`);
	return error.line === undefined
		? reason
		: t("apiClient.send.script.atLine", { reason, line: error.line });
}
