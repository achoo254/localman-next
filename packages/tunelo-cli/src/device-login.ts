/** `tunelo login`: OAuth 2.0 Device Authorization Grant (RFC 8628). */
import { hostname } from "node:os";
import {
	DEVICE_CODE_GRANT,
	IDP_DEFAULTS,
	type IdpEndpoints,
	OAuthResponseError,
	type TokenSet,
	postForm,
	tokenSetOf,
} from "./idp-client.js";

export interface DeviceAuthorization {
	deviceCode: string;
	userCode: string;
	verificationUri: string;
	verificationUriComplete: string | null;
	/** Seconds. */
	expiresIn: number;
	/** Seconds between polls. */
	interval: number;
}

/** Name the IdP shows on its approval page; it allows only `[\w ._'()-]`. */
export function deviceNameForIdp(name = hostname()): string {
	const cleaned = name
		.replace(/[^A-Za-z0-9 ._'()-]/g, "")
		.slice(0, 64)
		.trim();
	return cleaned || "tunelo";
}

function str(value: unknown): string | null {
	return typeof value === "string" && value.length > 0 ? value : null;
}

export async function startDeviceAuthorization(
	endpoints: IdpEndpoints,
	deviceName: string,
): Promise<DeviceAuthorization> {
	const { status, body } = await postForm(endpoints.deviceAuthorization, {
		client_id: IDP_DEFAULTS.clientId,
		scope: IDP_DEFAULTS.scope,
		resource: IDP_DEFAULTS.resource,
		device_name: deviceName,
	});
	const record =
		typeof body === "object" && body !== null
			? (body as Record<string, unknown>)
			: {};
	if (status >= 400 || record.error) {
		throw new OAuthResponseError(str(record.error) ?? "server_error", status);
	}
	const deviceCode = str(record.device_code);
	const userCode = str(record.user_code);
	const verificationUri = str(record.verification_uri);
	if (!deviceCode || !userCode || !verificationUri) {
		throw new Error("Device authorization response is incomplete");
	}
	return {
		deviceCode,
		userCode,
		verificationUri,
		verificationUriComplete: str(record.verification_uri_complete),
		expiresIn: typeof record.expires_in === "number" ? record.expires_in : 600,
		interval: typeof record.interval === "number" ? record.interval : 5,
	};
}

export interface PollOptions {
	/** Waits between polls; tests pass a fake. */
	sleep?: (ms: number) => Promise<void>;
	now?: () => number;
}

const SLOW_DOWN_STEP_S = 5;
const MAX_NETWORK_FAILURES = 3;

/**
 * Polls the token endpoint until the user approves, following RFC 8628
 * §3.5: `authorization_pending` waits, `slow_down` (and a 429) adds 5 s to
 * the interval, network trouble doubles it, `expired_token` /
 * `access_denied` and any other error end the login.
 */
export async function pollForTokens(
	endpoints: IdpEndpoints,
	authorization: DeviceAuthorization,
	options: PollOptions = {},
): Promise<TokenSet> {
	const sleep =
		options.sleep ??
		((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
	const now = options.now ?? Date.now;
	const deadline = now() + authorization.expiresIn * 1000;
	let interval = authorization.interval;
	let networkFailures = 0;

	while (now() < deadline) {
		await sleep(interval * 1000);
		try {
			return tokenSetOf(
				await postForm(endpoints.token, {
					grant_type: DEVICE_CODE_GRANT,
					device_code: authorization.deviceCode,
					client_id: IDP_DEFAULTS.clientId,
				}),
			);
		} catch (err) {
			if (!(err instanceof OAuthResponseError) || err.status >= 500) {
				// A blip should not cost the user the code; back off (§3.5).
				if (++networkFailures > MAX_NETWORK_FAILURES) throw err;
				interval *= 2;
				continue;
			}
			networkFailures = 0;
			if (err.error === "authorization_pending") continue;
			// The IdP rate-limits per IP (429): treat it like slow_down.
			if (err.error === "slow_down" || err.status === 429) {
				interval += SLOW_DOWN_STEP_S;
				continue;
			}
			throw new DeviceLoginError(err.error);
		}
	}
	throw new DeviceLoginError("expired_token");
}

const MESSAGES: Record<string, string> = {
	expired_token:
		"The code expired before it was approved. Run `tunelo login` again.",
	access_denied: "The sign-in was denied in the browser.",
};

export class DeviceLoginError extends Error {
	constructor(public readonly error: string) {
		super(MESSAGES[error] ?? `Sign-in failed (${error}).`);
		this.name = "DeviceLoginError";
	}
}
