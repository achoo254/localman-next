import type { Request, RequestHandler } from "express";
import { REQUEST_ID_HEADER } from "../../http/request-log.js";
import { tenantSettings } from "../../tenancy/tenant-settings.js";
import { type MockAddress, readMockAddress } from "./resolve-project.js";
import { SOURCE_HEADER } from "./upstream-headers.js";

const ALLOWED_METHODS = "GET,POST,PUT,PATCH,DELETE,OPTIONS";
/** A comma-separated list of header names (RFC 9110 tokens). */
const HEADER_NAMES =
	/^[\w!#$%&'*+.^`|~-]+(?:[ \t]*,[ \t]*[\w!#$%&'*+.^`|~-]+)*$/;
const MAX_REQUESTED_HEADERS = 1024;

/**
 * Open CORS for a public API: any origin (`*`, so browsers never send
 * cookies or credentials with it), every mock method, and whatever
 * request headers the preflight names (so `Authorization` works; the
 * MCP endpoint's 401 challenge is readable through `WWW-Authenticate`,
 * who answered through `X-Localman-Source`).
 * Preflights end here with 204 and are not rate limited or counted.
 */
export const mockCors: RequestHandler = (req, res, next) => {
	res.setHeader("Access-Control-Allow-Origin", "*");
	res.setHeader(
		"Access-Control-Expose-Headers",
		`${REQUEST_ID_HEADER}, ${SOURCE_HEADER}, Retry-After, WWW-Authenticate`,
	);
	if (req.method !== "OPTIONS") {
		next();
		return;
	}
	res.setHeader("Access-Control-Allow-Methods", ALLOWED_METHODS);
	const requested = req.headers["access-control-request-headers"];
	if (
		typeof requested === "string" &&
		requested.length <= MAX_REQUESTED_HEADERS &&
		HEADER_NAMES.test(requested)
	) {
		res.setHeader("Access-Control-Allow-Headers", requested);
	}
	res.setHeader("Vary", "Access-Control-Request-Headers");
	res.setHeader("Access-Control-Max-Age", "600");
	res.status(204).end();
};

const addresses = new WeakMap<Request, MockAddress>();

/**
 * Reads which project the request addresses (Host or `/m/:secret`)
 * once, before rate limits and the body parser need it.
 */
export const readAddress: RequestHandler = (req, _res, next) => {
	const address = readMockAddress(
		req.hostname ?? "",
		req.path,
		tenantSettings().mockBaseDomain,
	);
	if (address) addresses.set(req, address);
	next();
};

/** The project address read by `readAddress`, if any. */
export function addressOf(req: Request): MockAddress | undefined {
	return addresses.get(req);
}

/** The first characters of a secret, enough to correlate logs. */
export function maskSecret(secret: string): string {
	return `${secret.slice(0, 4)}…`;
}

/**
 * The path logged for a mock request: the raw path without its query,
 * with the secret masked when it is in the path (`/m/{secret}/…`; a
 * secret in the Host is never logged). `null` when the request addresses
 * no project, so the matched template (`/healthz`) or "unmatched" is used.
 */
export function mockRouteOf(req: Request): string | null {
	const address = addressOf(req);
	if (!address) return null;
	const raw = req.path.split("/").slice(1);
	if (raw.at(-1) === "") raw.pop();
	// The path fallback adds `m` and the secret before the segments.
	if (raw.length !== address.segments.length + 2) return req.path;
	const rest = raw.slice(2).map((segment) => `/${segment}`);
	return `/m/${maskSecret(address.secret)}${rest.join("")}`;
}
