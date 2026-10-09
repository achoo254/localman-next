import { randomUUID } from "node:crypto";
import type { Request, RequestHandler, Response } from "express";
import { runtimeSettings } from "../../config/runtime-settings.js";
import { type MockAddress, readMockAddress } from "./resolve-project.js";

export const REQUEST_ID_HEADER = "X-Localman-Request-Id";
const ALLOWED_METHODS = "GET,POST,PUT,PATCH,DELETE,OPTIONS";
/** A comma-separated list of header names (RFC 9110 tokens). */
const HEADER_NAMES =
	/^[\w!#$%&'*+.^`|~-]+(?:[ \t]*,[ \t]*[\w!#$%&'*+.^`|~-]+)*$/;
const MAX_REQUESTED_HEADERS = 1024;

/**
 * A random id on every response, for support requests; kept in
 * `res.locals` so error logs carry the id the client saw.
 */
export const requestId: RequestHandler = (_req, res, next) => {
	const id = randomUUID();
	res.locals.requestId = id;
	res.setHeader(REQUEST_ID_HEADER, id);
	next();
};

/** The id `requestId` gave this response, if any. */
export function requestIdOf(res: Response): string | undefined {
	const id: unknown = res.locals.requestId;
	return typeof id === "string" ? id : undefined;
}

/**
 * Open CORS for a public API: any origin (`*`, so browsers never send
 * cookies or credentials with it), every mock method, and whatever
 * request headers the preflight names (so `Authorization` works).
 * Preflights end here with 204 and are not rate limited or counted.
 */
export const mockCors: RequestHandler = (req, res, next) => {
	res.setHeader("Access-Control-Allow-Origin", "*");
	res.setHeader(
		"Access-Control-Expose-Headers",
		`${REQUEST_ID_HEADER}, Retry-After`,
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
		runtimeSettings().mockBaseDomain,
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
