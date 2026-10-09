/**
 * One trip through the Localman proxy (`POST /api/v1/proxy`) for a
 * prepared request. Used by the proxy-only sender and by the router for
 * proxy and Tunelo sends.
 */
import {
	type ClientResponse,
	type PreparedRequest,
	type RequestSettings,
	proxyResponseSchema,
	toProxyEnvelope,
} from "@localman/shared/api-client";
import { activeTranslator } from "../../../i18n/active-translator";
import { ApiError, apiRequest, errorMessage } from "../../../lib/api-client";
import type { SendFailure } from "./workbench-types";

export type HopFailure = Pick<
	SendFailure,
	"code" | "message" | "status" | "details"
>;

export type ProxyHopOutcome =
	| { kind: "response"; response: ClientResponse }
	| { kind: "failed"; failure: HopFailure }
	| { kind: "cancelled" };

function isAbort(error: unknown): boolean {
	return error instanceof DOMException && error.name === "AbortError";
}

export async function proxyHop(
	prepared: PreparedRequest,
	settings: Pick<
		RequestSettings,
		"followRedirects" | "timeoutMs" | "sendClientIp"
	>,
	signal: AbortSignal,
): Promise<ProxyHopOutcome> {
	let payload: unknown;
	try {
		payload = await apiRequest("/api/v1/proxy", {
			method: "POST",
			body: toProxyEnvelope(prepared, settings),
			signal,
		});
	} catch (error) {
		if (isAbort(error)) return { kind: "cancelled" };
		const apiError = error instanceof ApiError ? error : null;
		return {
			kind: "failed",
			failure: {
				code: apiError?.code ?? "NETWORK_ERROR",
				message: errorMessage(error),
				status: apiError?.status ?? null,
				details: apiError?.details,
			},
		};
	}
	const parsed = proxyResponseSchema.safeParse(payload);
	if (!parsed.success) {
		const message = activeTranslator().t("common.errors.server");
		return {
			kind: "failed",
			failure: { code: "INVALID_RESPONSE", message, status: null },
		};
	}
	return { kind: "response", response: parsed.data };
}
