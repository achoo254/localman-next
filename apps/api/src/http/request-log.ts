import { randomUUID } from "node:crypto";
import type { Request, RequestHandler, Response } from "express";
import type { Logger } from "../logger.js";

export const REQUEST_ID_HEADER = "X-Localman-Request-Id";
/** Logged in place of the path when no route matched (it may hold anything). */
export const UNMATCHED_ROUTE = "(unmatched)";
const MAX_ROUTE_LENGTH = 300;
const OBJECT_ID = /^[a-f\d]{24}$/i;

/**
 * The route a server logs for a request, or `null` to fall back to the
 * matched Express route template. Must never return a secret or a query.
 */
export type DescribeRoute = (req: Request) => string | null;

/** The id `requestLog` gave this response, if any. */
export function requestIdOf(res: Response): string | undefined {
	const id: unknown = res.locals.requestId;
	return typeof id === "string" ? id : undefined;
}

function segmentsOf(path: string): string[] {
	const parts = path.split("/").slice(1);
	if (parts.at(-1) === "") parts.pop();
	return parts;
}

function templateOf(req: Request): string | null {
	const route: unknown = req.route;
	if (typeof route !== "object" || route === null || !("path" in route)) {
		return null;
	}
	return typeof route.path === "string" ? route.path : null;
}

interface MatchedRoute {
	/** Mount prefix plus template, e.g. `/api/v1/projects/:projectId`. */
	readonly route: string;
	readonly projectId?: string;
}

/**
 * Rebuilds the full template of the matched route. Express restores
 * `baseUrl` and `params` when an error leaves a router, but keeps
 * `req.route`; route paths hold only static segments and `:name` params,
 * so the mount prefix is whatever precedes the template's segments and
 * each param sits at the same position in the raw path.
 */
function matchedRouteOf(req: Request): MatchedRoute | null {
	const template = templateOf(req);
	if (template === null) return null;
	const path = segmentsOf(req.originalUrl.split("?")[0] ?? "");
	const templateSegments = segmentsOf(template);
	const baseLength = Math.max(0, path.length - templateSegments.length);
	const base = path.slice(0, baseLength);
	const route = `${base.length > 0 ? `/${base.join("/")}` : ""}${template}`;
	const index = templateSegments.indexOf(":projectId");
	const projectId = index >= 0 ? path[baseLength + index] : undefined;
	return projectId !== undefined && OBJECT_ID.test(projectId)
		? { route, projectId }
		: { route };
}

function projectIdOf(
	res: Response,
	matched: MatchedRoute | null,
): string | undefined {
	const id: unknown = res.locals.projectId;
	return typeof id === "string" ? id : matched?.projectId;
}

/**
 * Gives every request a random id (`res.locals.requestId` and the
 * `X-Localman-Request-Id` response header, for support requests) and
 * logs one JSON line when the response ends: method, normalized route,
 * status, duration, request id and the project when known. Headers,
 * cookies, bodies and query strings are never logged; the route is the
 * matched template (`describeRoute` may supply a masked path instead).
 */
export function requestLog(
	logger: Logger,
	describeRoute?: DescribeRoute,
): RequestHandler {
	return (req, res, next) => {
		const id = randomUUID();
		const started = process.hrtime.bigint();
		res.locals.requestId = id;
		res.setHeader(REQUEST_ID_HEADER, id);
		res.once("close", () => {
			const matched = matchedRouteOf(req);
			const route = describeRoute?.(req) ?? matched?.route ?? UNMATCHED_ROUTE;
			const elapsed = Number(process.hrtime.bigint() - started) / 1e6;
			const projectId = projectIdOf(res, matched);
			logger.info(
				{
					requestId: id,
					method: req.method,
					route: route.slice(0, MAX_ROUTE_LENGTH),
					status: res.statusCode,
					ms: Math.round(elapsed * 10) / 10,
					...(projectId ? { projectId } : {}),
					...(res.writableFinished ? {} : { aborted: true }),
				},
				"request",
			);
		});
		next();
	};
}
