import {
	type AnyOperation,
	OperationError,
	defineOperation,
} from "@localman/operations";
import {
	MAX_PROXY_ENVELOPE_BYTES,
	proxyRequestSchema,
	proxyResponseSchema,
} from "@localman/shared/api-client";
import { runtimeSettings } from "../../config/runtime-settings.js";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import { type Logger, createLogger } from "../../logger.js";
import { forwardRequest } from "./proxy-forwarder.js";
import { admitProxyRequest } from "./proxy-quota.js";
import { type SsrfGuard, createSsrfGuard } from "./ssrf-guard.js";

let proxyLogger: Logger = createLogger("silent");

/** Installed by `main.ts` with the app logger; silent until then. */
export function configureProxyLogger(logger: Logger): void {
	proxyLogger = logger;
}

export interface ProxyDependencies {
	readonly guard: SsrfGuard;
	readonly logger: () => Logger;
}

/**
 * Host as logged: a mock URL's host carries the project secret
 * (`{secret}.{MOCK_BASE_DOMAIN}`), so that label is masked.
 */
function loggedHost(url: string): string {
	const host = new URL(url).hostname;
	const base = runtimeSettings().mockBaseDomain.split(":")[0] ?? "";
	return base && host.endsWith(`.${base}`) ? `[secret].${base}` : host;
}

/** `http` or `https`: how callers reach Localman (`Forwarded: proto=`). */
function publicScheme(): string {
	return new URL(runtimeSettings().publicUrl).protocol.replace(":", "");
}

const DESCRIPTION = `Sends an HTTP request from the Localman server and returns the response, like the Send button of the API client. Give method, absolute http(s) url, headers as an ordered list of {name, value} (repeated names allowed; Cookie, User-Agent, Origin and Host may be set) and body: bodyType "text" for UTF-8 text, "base64" for bytes, "none" without body (GET and HEAD carry none). options: followRedirects (default true, at most 10), timeoutMs (1000–120000, default 30000), sendClientIp (default true: adds X-Forwarded-For, X-Real-IP and Forwarded with the caller's IP). Every request also carries X-Localman-Proxy: 1, and Host is forced to the URL's host for Localman mock URLs. The response has status, headers in arrival order (Set-Cookie included, only shown), body as UTF-8 text or base64 (bodyEncoding), size, truncated (body cut at 10 MB), timings in ms {dns, connect, tls, ttfb, total} and finalUrl after redirects. Private, loopback and link-local targets (localhost, 10.x, 192.168.x, 169.254.169.254, fc00::/7…) and mail ports are refused with 403 PROXY_TARGET_BLOCKED; expose a local server with a Tunelo tunnel instead. Other failures: 502 PROXY_DNS_FAILED, PROXY_CONNECTION_FAILED (details.cause), PROXY_TOO_MANY_REDIRECTS, 504 PROXY_TIMEOUT. Every call counts toward the plan's monthly proxy requests (429 MONTHLY_QUOTA_EXCEEDED) and a per-account rate limit (429 RATE_LIMITED).`;

/** `client.sendRequest`; tests build it with their own guard and logger. */
export function createProxyOperations(deps: ProxyDependencies): AnyOperation[] {
	const sendRequest = defineOperation({
		id: "client.sendRequest",
		method: "POST",
		path: "/proxy",
		summary: "Send an HTTP request through the Localman proxy",
		description: DESCRIPTION,
		input: proxyRequestSchema,
		output: proxyResponseSchema,
		scopes: [USER_SCOPE],
		annotations: { readOnly: false, destructive: false, idempotent: false },
		toolset: "client",
		mcp: true,
		bodyLimit: MAX_PROXY_ENVELOPE_BYTES,
		handler: async (ctx, input) => {
			const sub = requireSubject(ctx);
			await admitProxyRequest(sub);
			const started = performance.now();
			const meta = { sub, host: loggedHost(input.url), method: input.method };
			try {
				const response = await forwardRequest(input, {
					guard: deps.guard,
					clientIp: ctx.clientIp,
					forwardedProto: publicScheme(),
				});
				const ms = Math.round(performance.now() - started);
				deps.logger().info({ ...meta, status: response.status, ms }, "proxy");
				return response;
			} catch (error) {
				const ms = Math.round(performance.now() - started);
				const code =
					error instanceof OperationError ? error.code : "INTERNAL_ERROR";
				deps.logger().info({ ...meta, error: code, ms }, "proxy");
				throw error;
			}
		},
	});
	return [sendRequest];
}

/**
 * Operations of the API client proxy, for the registry. The guard reads
 * `PROXY_BLOCKED_CIDRS` and `MOCK_BASE_DOMAIN` from the runtime settings
 * at every call and the machine's interface addresses itself.
 */
export const proxyOperations: AnyOperation[] = createProxyOperations({
	guard: createSsrfGuard({
		extraBlocked: () => runtimeSettings().proxyBlockedCidrs,
		mockBaseDomain: () => runtimeSettings().mockBaseDomain,
	}),
	logger: () => proxyLogger,
});
