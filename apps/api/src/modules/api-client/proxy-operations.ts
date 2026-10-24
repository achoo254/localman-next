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
import {
	USER_SCOPE,
	requireSubject,
	sessionIdOf,
} from "../../http/require-auth.js";
import { type Logger, createLogger } from "../../logger.js";
import { localmanDomainOf } from "../../tenancy/idp-tenant-directory.js";
import { tenantSettings } from "../../tenancy/tenant-settings.js";
import { fillVariables } from "./agent-variable-fill.js";
import { routeLocalTarget } from "./local-target-route.js";
import {
	PROXY_CONCURRENCY,
	type ProxyConcurrency,
	createProxyConcurrency,
	proxyBusy,
} from "./proxy-concurrency.js";
import { forwardRequest } from "./proxy-forwarder.js";
import { admitProxyRequest } from "./proxy-quota.js";
import { createRuntimeSsrfGuard } from "./runtime-ssrf-guard.js";
import { maskError, maskResponse, maskSecrets } from "./secret-mask.js";
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
	/** Where a local target goes; defaults to the user's tunnel (`routeLocalTarget`). */
	readonly routeLocal?: typeof routeLocalTarget;
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

const DESCRIPTION = `Sends an HTTP request from the Localman server and returns the response, like the Send button of the API client. Give method, absolute http(s) url, headers as an ordered list of {name, value} (repeated names allowed; Cookie, User-Agent, Origin and Host may be set) and body: bodyType "text" for UTF-8 text, "base64" for bytes, "none" without body (GET and HEAD carry none). options: followRedirects (default true, at most 10), timeoutMs (1000–120000, default 30000), sendClientIp (default true: adds X-Forwarded-For, X-Real-IP and Forwarded with the caller's IP). Every request also carries X-Localman-Proxy: 1, and Host is forced to the URL's host for Localman mock URLs and Tunelo tunnel URLs. The response has status, headers in arrival order (Set-Cookie included, only shown), body as UTF-8 text or base64 (bodyEncoding), size, truncated (body cut at 10 MB), timings in ms {dns, connect, tls, ttfb, total} and finalUrl after redirects. A local target (localhost, 127.x, a LAN address) goes through the user's tunnel like the Send button: the enabled tunnel URL saved for that host and port, else for localhost the one live Tunelo tunnel of that port (from machines linked with \`tunelo link\`; with an agent's token the account's own tunnels are not read); the path and query are kept and finalUrl shows the tunnel. Only HTTP tunnels count. Several tunnels for the port answer 409 PROXY_TUNNEL_AMBIGUOUS (send to one of the listed tunnel URLs directly); a Tunelo source that did not answer, with no tunnel found, 502 PROXY_TUNNEL_UNAVAILABLE; none answers 403 PROXY_TARGET_BLOCKED with how to open one (\`tunelo http <port>\`). Other private and link-local targets (169.254.169.254, fc00::/7…) and mail ports are refused with 403 PROXY_TARGET_BLOCKED. Other failures: 502 PROXY_DNS_FAILED, PROXY_CONNECTION_FAILED (details.cause), PROXY_TOO_MANY_REDIRECTS, 504 PROXY_TIMEOUT. Every call counts toward the plan's monthly proxy requests (429 MONTHLY_QUOTA_EXCEEDED) and a per-account rate limit (429 RATE_LIMITED); at most ${PROXY_CONCURRENCY.perUser} requests of an account (${PROXY_CONCURRENCY.total} in all) run at once, more answer 429 PROXY_BUSY (details.scope user or server) without counting. With \`variables\` ({workspaceId, collectionId?, environmentId?}), the server fills \`{{name}}\` in url, headers and a text body from the workspace's globals, the collection's variables and the environment, the caller's local value first, as the Send button would: secrets included, but their values never come back (echoes in the response, the final URL and errors read [secret]; copies shorter than 4 characters or transformed by the upstream are not caught). A secret the caller may not read stops the send with 409 SECRET_WITHHELD (details.keys; details.vault lists those in the user's browser vault, usable once the user turns on "Let agents use" for them); other unknown names stay as typed. A filled secret goes only to the hosts the user allowed for it: the URL's host and a Host header if one is set must be one of them (409 AGENT_USE_REQUIRED when not turned on, 409 AGENT_HOST_NOT_ALLOWED otherwise), and a redirect elsewhere is not followed (its 3xx is the answer). 404 SECRET_VAULT_DISABLED where the server does not offer it.`;

/** `client.sendRequest`; tests build it with their own guard and logger. */
export function createProxyOperations(deps: ProxyDependencies): AnyOperation[] {
	const concurrency = deps.concurrency ?? createProxyConcurrency();
	const routeLocal = deps.routeLocal ?? routeLocalTarget;
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
		// Sending from the server is riskier than editing collections: the
		// agent's token needs the IdP's `client:send` grant on top.
		mcpScope: "client:send",
		bodyLimit: MAX_PROXY_ENVELOPE_BYTES,
		handler: async (ctx, input) => {
			const sub = requireSubject(ctx);
			// `{{variables}}` filled first: a send stopped there costs nothing.
			const { request, secrets, redirectAllowed } = await fillVariables(
				sub,
				input,
			);
			// Before the quota: a request refused as busy costs nothing.
			const slot = concurrency.acquire(sub);
			if (!slot.ok) {
				throw await proxyBusy(sub, slot.scope, concurrency.limits);
			}
			const started = performance.now();
			const host = maskSecrets(loggedHost(request.url), secrets);
			const meta = { sub, host, method: request.method };
			try {
				// Counted like any refused target, then a local one goes
				// through the user's tunnel.
				await admitProxyRequest(sub);
				const route = await routeLocal(sub, sessionIdOf(ctx), request.url);
				// A local target goes through a tunnel: Localman's host, never
				// a place for a filled secret.
				if (redirectAllowed && !redirectAllowed(new URL(route.url))) {
					throw new OperationError(
						409,
						"AGENT_HOST_NOT_ALLOWED",
						"These secrets may not be sent through a tunnel",
					);
				}
				const response = await forwardRequest(
					{ ...request, url: route.url },
					{
						guard: deps.guard,
						clientIp: ctx.clientIp,
						forwardedProto: publicScheme(),
						// The browser or agent gave up: stop the upstream request.
						signal: ctx.signal,
						...(redirectAllowed ? { redirectAllowed } : {}),
					},
				);
				const ms = Math.round(performance.now() - started);
				// `via`: the tunnel a local target went through, for support.
				const via = route.tunnel ? { via: route.tunnel } : {};
				deps
					.logger()
					.info({ ...meta, ...via, status: response.status, ms }, "proxy");
				return maskResponse(response, secrets);
			} catch (error) {
				const ms = Math.round(performance.now() - started);
				const code =
					error instanceof OperationError ? error.code : "INTERNAL_ERROR";
				deps.logger().info({ ...meta, error: code, ms }, "proxy");
				throw maskError(error, secrets);
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
