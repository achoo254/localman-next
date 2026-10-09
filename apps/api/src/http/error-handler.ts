import { OperationError } from "@localman/operations";
import type { ErrorRequestHandler, RequestHandler } from "express";
import type { Logger } from "../logger.js";
import { requestIdOf } from "./request-log.js";

/** body-parser / raw-body error types mapped to client-safe errors. */
const BODY_ERRORS: Readonly<
	Record<string, { status: number; code: string; message: string }>
> = {
	"entity.too.large": {
		status: 413,
		code: "PAYLOAD_TOO_LARGE",
		message: "Request body is too large",
	},
	"entity.parse.failed": {
		status: 400,
		code: "INVALID_JSON",
		message: "Request body is not valid JSON",
	},
	"encoding.unsupported": {
		status: 415,
		code: "UNSUPPORTED_MEDIA_TYPE",
		message: "Unsupported content encoding",
	},
	"charset.unsupported": {
		status: 415,
		code: "UNSUPPORTED_MEDIA_TYPE",
		message: "Unsupported charset",
	},
	"request.aborted": {
		status: 400,
		code: "BAD_REQUEST",
		message: "Request was aborted",
	},
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

/** Returns a client-safe error, or `null` when the error is unexpected. */
function toKnownError(err: unknown): OperationError | null {
	// A ZodError reaching here was thrown while parsing server-side data, so it
	// stays a 500; client input errors arrive already wrapped as OperationError.
	if (err instanceof OperationError) return err;
	if (!isRecord(err)) return null;

	const bodyError =
		typeof err.type === "string" ? BODY_ERRORS[err.type] : undefined;
	if (bodyError) {
		return new OperationError(
			bodyError.status,
			bodyError.code,
			bodyError.message,
		);
	}
	// http-errors convention: `expose` marks messages safe for clients.
	const status = err.status;
	if (
		err.expose === true &&
		typeof status === "number" &&
		status >= 400 &&
		status < 500 &&
		typeof err.message === "string"
	) {
		return new OperationError(status, "BAD_REQUEST", err.message);
	}
	return null;
}

export const notFoundHandler: RequestHandler = (_req, res) => {
	res
		.status(404)
		.json(new OperationError(404, "NOT_FOUND", "Route not found").toBody());
};

/** Formats every error as `{ error: { code, message } }`; never leaks stacks. */
export function createErrorHandler(logger: Logger): ErrorRequestHandler {
	return (err: unknown, req, res, next) => {
		if (res.headersSent) {
			next(err);
			return;
		}
		const known = toKnownError(err);
		if (known) {
			res.status(known.status).json(known.toBody());
			return;
		}
		// No path: the request log line with the same id carries the
		// normalized route (a mock path may hold the project secret).
		logger.error(
			{ err, method: req.method, requestId: requestIdOf(res) },
			"Unhandled request error",
		);
		res
			.status(500)
			.json(
				new OperationError(
					500,
					"INTERNAL_ERROR",
					"Internal server error",
				).toBody(),
			);
	};
}
