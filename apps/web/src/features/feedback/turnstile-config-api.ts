import { apiRequest } from "../../lib/api-client";
import { expectRecord, optionalString } from "../../lib/json-guards";

export interface TurnstileConfig {
	/** Cloudflare Turnstile site key; null when the check is turned off. */
	turnstileSiteKey: string | null;
}

/**
 * Public: visitors who are not signed in can read it. The feedback forms
 * share the site key the server serves with the public form config.
 */
export async function fetchTurnstileConfig(): Promise<TurnstileConfig> {
	const data = expectRecord(
		await apiRequest("/api/v1/feedback/pro-interest/config", {
			redirectOnUnauthorized: false,
		}),
		"turnstile config",
	);
	return { turnstileSiteKey: optionalString(data, "turnstileSiteKey") };
}
