/**
 * Text of the errors a send can stop on before reaching the network, in
 * the language on screen. Plain functions (the sender runs outside React),
 * so they read the active translator.
 */
import {
	type RequestPrepareError,
	type ResolverLayer,
	resolveVariable,
} from "@localman/shared/api-client";
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

/**
 * Why a send stops on the secret `name` it cannot fill in: locked in the
 * vault (unlocking helps), sealed by another vault (only replacing the
 * value helps), or a shared secret only Editors can see.
 */
export function withheldMessage(
	name: string,
	layers: readonly ResolverLayer[] | undefined,
): string {
	const { t } = activeTranslator();
	const winner = layers ? resolveVariable(name, layers).winner : null;
	if (winner?.unreadable) return t("apiClient.send.secretUnreadable", { name });
	if (winner?.locked) return t("apiClient.send.secretLocked", { name });
	return t("apiClient.send.secretWithheld", { name });
}

/** What went wrong in a script, with the line when the engine gave one. */
export function scriptErrorMessage(error: ScriptError): string {
	const { t } = activeTranslator();
	const reason = t(`apiClient.send.script.${error.code}`);
	return error.line === undefined
		? reason
		: t("apiClient.send.script.atLine", { reason, line: error.line });
}
