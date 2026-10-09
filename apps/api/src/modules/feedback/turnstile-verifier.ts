import { TURNSTILE_TESTING_SECRET } from "../../config/feature-env.js";
import type { TurnstileSettings } from "../../config/runtime-settings.js";

const VERIFY_TIMEOUT_MS = 5_000;

/** `unavailable`: Cloudflare could not be asked; the token is unknown. */
export type TurnstileOutcome = "valid" | "invalid" | "unavailable";

interface SiteverifyReply {
	readonly success: boolean;
	readonly hostname: string | null;
	readonly action: string | null;
}

function readReply(body: unknown): SiteverifyReply {
	const record: Record<string, unknown> =
		typeof body === "object" && body !== null
			? Object.fromEntries(Object.entries(body))
			: {};
	const text = (value: unknown): string | null =>
		typeof value === "string" ? value : null;
	return {
		success: record.success === true,
		hostname: text(record.hostname),
		action: text(record.action),
	};
}

/**
 * Verifies a Cloudflare Turnstile token with siteverify. A token is valid
 * only when it was solved on our public host for `expectedAction`: every
 * widget of the app declares its form's action, so a token minted for
 * another form or site, or without action, is refused (testing secrets
 * may answer without one). The secret and the token are never logged; a
 * timeout or a 5xx is `unavailable` so the caller fails closed without
 * blaming the user's token.
 */
export async function verifyTurnstile(
	settings: TurnstileSettings,
	token: string,
	clientIp: string | null,
	expectedAction: string,
): Promise<TurnstileOutcome> {
	let response: Response;
	try {
		response = await fetch(settings.verifyUrl, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				secret: settings.secretKey,
				response: token,
				...(clientIp ? { remoteip: clientIp } : {}),
			}),
			signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
		});
	} catch {
		return "unavailable";
	}
	if (!response.ok) return "unavailable";
	const reply = readReply(await response.json().catch(() => null));
	if (!reply.success) return "invalid";
	// Testing secrets (refused in production) answer with a dummy hostname
	// and may omit the action.
	const testing = TURNSTILE_TESTING_SECRET.test(settings.secretKey);
	const hostOk = testing || reply.hostname === settings.expectedHostname;
	const actionOk =
		reply.action === expectedAction || (testing && !reply.action);
	return hostOk && actionOk ? "valid" : "invalid";
}
