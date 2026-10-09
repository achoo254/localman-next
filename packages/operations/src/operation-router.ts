import { type Request, type RequestHandler, Router } from "express";
import { executeOperation } from "./execute-operation.js";
import { assertNoOperationConflicts } from "./operation-conflicts.js";
import { OperationError } from "./operation-error.js";
import { type QueryCoercer, createQueryCoercer } from "./query-coercion.js";
import {
	type AnyOperation,
	type AuthContext,
	DRY_RUN_QUERY_PARAM,
	LOWERCASE_METHOD,
} from "./types.js";

export interface OperationRouterOptions {
	/**
	 * Resolves the caller from the request; `null` means anonymous. Errors it
	 * throws are forwarded to the Express error handler.
	 */
	resolveAuth(req: Request): AuthContext | null | Promise<AuthContext | null>;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return (
		typeof value === "object" &&
		value !== null &&
		Object.getPrototypeOf(value) === Object.prototype
	);
}

function readDryRun(req: Request, op: AnyOperation): boolean {
	const raw = req.query[DRY_RUN_QUERY_PARAM];
	if (raw === undefined) return false;
	if (!op.dryRun) {
		// Silently ignoring the flag would perform a real write the caller
		// believed was only a preview.
		throw new OperationError(
			400,
			"VALIDATION_ERROR",
			`Operation "${op.id}" does not support "${DRY_RUN_QUERY_PARAM}"`,
		);
	}
	if (raw === "false" || raw === "0") return false;
	if (raw === "true" || raw === "1") return true;
	throw new OperationError(
		400,
		"VALIDATION_ERROR",
		`Query "${DRY_RUN_QUERY_PARAM}" must be true or false`,
	);
}

function hasRequestBody(req: Request): boolean {
	const length = req.headers["content-length"];
	if (length !== undefined) return Number(length) > 0;
	return req.headers["transfer-encoding"] !== undefined;
}

/**
 * GET reads its input from the query string. Every other method reads only
 * the JSON body: accepting query values or form/text bodies there would let a
 * cross-site form submit (no CORS preflight) trigger a mutation.
 * Path params win over everything so a body cannot retarget a route.
 */
function collectRawInput(
	req: Request,
	op: AnyOperation,
	coerce: QueryCoercer,
): Record<string, unknown> {
	const params = coerce(req.params);
	if (op.method === "GET") {
		const { [DRY_RUN_QUERY_PARAM]: _dryRun, ...query } = req.query;
		return { ...coerce(query), ...params };
	}

	if (hasRequestBody(req) && !req.is("application/json")) {
		throw new OperationError(
			415,
			"UNSUPPORTED_MEDIA_TYPE",
			"Request body must be sent as application/json",
		);
	}
	const body: unknown = req.body;
	if (body !== undefined && !isPlainObject(body)) {
		throw new OperationError(
			400,
			"VALIDATION_ERROR",
			"Request body must be a JSON object",
		);
	}
	return { ...body, ...params };
}

function createRouteHandler(
	op: AnyOperation,
	options: OperationRouterOptions,
): RequestHandler {
	const coerce = createQueryCoercer(op.input);
	// Express 5 forwards rejected promises to the error handler.
	return async (req, res) => {
		const { output } = await executeOperation(op, {
			auth: await options.resolveAuth(req),
			clientIp: req.ip ?? null,
			readRequest: () => ({
				dryRun: readDryRun(req, op),
				input: collectRawInput(req, op, coerce),
			}),
		});
		res.status(op.successStatus).json(output);
	};
}

/**
 * Builds an Express router exposing every operation at its declared path.
 * Throws when two operations share an id, a route or an MCP tool name.
 */
export function createOperationRouter(
	operations: readonly AnyOperation[],
	options: OperationRouterOptions,
): Router {
	assertNoOperationConflicts(operations);
	const router = Router();
	for (const op of operations) {
		router[LOWERCASE_METHOD[op.method]](
			op.path,
			createRouteHandler(op, options),
		);
	}
	return router;
}
