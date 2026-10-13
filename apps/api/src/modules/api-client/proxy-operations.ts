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
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import { type Logger, createLogger } from "../../logger.js";
import { localmanDomainOf } from "../../tenancy/idp-tenant-directory.js";
import { tenantSettings } from "../../tenancy/tenant-settings.js";
import {
	PROXY_CONCURRENCY,
	type ProxyConcurrency,
	createProxyConcurrency,
	proxyBusy,
} from "./proxy-concurrency.js";
import { forwardRequest } from "./proxy-forwarder.js";
import { admitProxyRequest } from "./proxy-quota.js";
import { createRuntimeSsrfGuard } from "./runtime-ssrf-guard.js";
import { type SsrfGuard, normalizeHostname } from "./ssrf-guard.js";

let proxyLogger: Logger = createLogger("silent");

/** Installed by `main.ts` with the app logger; silent until then. */
export function configureProxyLogger(logger: Logger): void {
	proxyLogger = logger;
}

export interface ProxyDependencies {
	readonly guard: SsrfGuard;
	readonly logger: () => Logger;
	/** Requests in flight; defaults to `PROXY_CONCURRENCY`. */
	readonly concurrency?: ProxyConcurrency;
}

/**
 * Host as logged: a mock URL's host carries the project secret
 * (`{secret}.{MOCK_BASE_DOMAIN}`), so that label is masked.
 */
function loggedHost(url: string): string {
	const host = normalizeHostname(new URL(url).hostname);
	const base = normalizeHostname(
		tenantSettings().mockBaseDomain.split(":")[0] ?? "",
	);
	if (base && host.endsWith(`.${base}`)) return `[secret].${base}`;
	// Another tenant's mock host: its secret is masked too.
	const [label, ...rest] = host.split(".");
	const other = localmanDomainOf(host) !== undefined && label !== "localman";
	return other ? `[secret].${rest.join(".")}` : host;
}

/** `http` or `https`: how callers reach Localman (`Forwarded: proto=`). */
function publicScheme(): string {
	return new URL(tenantSettings().publicUrl).protocol.replace(":", "");
}

const DESCRIPTION = `Sends an HTTP request from the Localman server and returns the response, like the Send button of the API client. Give method, absolute http(s) url, headers as an ordered list of {name, value} (repeated names allowed; Cookie, User-Agent, Origin and Host may be set) and body: bodyType "text" for UTF-8 text, "base64" for bytes, "none" without body (GET and HEAD carry none). options: followRedirects (default true, at most 10), timeoutMs (1000–120000, default 30000), sendClientIp (default true: adds X-Forwarded-For, X-Real-IP and Forwarded with the caller's IP). Every request also carries X-Localman-Proxy: 1, and Host is forced to the URL's host for Localman mock URLs and Tunelo tunnel URLs. The response has status, headers in arrival order (Set-Cookie included, only shown), body as UTF-8 text or base64 (bodyEncoding), size, truncated (body cut at 10 MB), timings in ms {dns, connect, tls, ttfb, total} and finalUrl after redirects. Private, loopback and link-local targets (localhost, 10.x, 192.168.x, 169.254.169.254, fc00::/7…) and mail ports are refused with 403 PROXY_TARGET_BLOCKED; expose a local server with a Tunelo tunnel instead. Other failures: 502 PROXY_DNS_FAILED, PROXY_CONNECTION_FAILED (details.cause), PROXY_TOO_MANY_REDIRECTS, 504 PROXY_TIMEOUT. Every call counts toward the plan's monthly proxy requests (429 MONTHLY_QUOTA_EXCEEDED) and a per-account rate limit (429 RATE_LIMITED); at most ${PROXY_CONCURRENCY.perUser} requests of an account (${PROXY_CONCURRENCY.total} in all) run at once, more answer 429 PROXY_BUSY (details.scope user or server) without counting.`;

/** `client.sendRequest`; tests build it with their own guard and logger. */
export function createProxyOperations(deps: ProxyDependencies): AnyOperation[] {
	const concurrency = deps.concurrency ?? createProxyConcurrency();
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
			// Before the quota: a request refused as busy costs nothing.
			const slot = concurrency.acquire(sub);
			if (!slot.ok) {
				throw await proxyBusy(sub, slot.scope, concurrency.limits);
			}
			const started = performance.now();
			const meta = { sub, host: loggedHost(input.url), method: input.method };
			try {
				await admitProxyRequest(sub);
				const response = await forwardRequest(input, {
					guard: deps.guard,
					clientIp: ctx.clientIp,
					forwardedProto: publicScheme(),
					// The browser or agent gave up: stop the upstream request.
					signal: ctx.signal,
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
			} finally {
				slot.release();
			}
		},
	});
	return [sendRequest];
}

/** Operations of the API client proxy, for the registry. */
export const proxyOperations: AnyOperation[] = createProxyOperations({
	guard: createRuntimeSsrfGuard(),
	logger: () => proxyLogger,
});
