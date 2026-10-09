import type { Response } from "express";

/** JSON-RPC 2.0 error codes the MCP endpoints answer before the SDK runs. */
export const JSON_RPC_INVALID_REQUEST = -32600;
export const JSON_RPC_METHOD_NOT_FOUND = -32601;
export const JSON_RPC_INTERNAL_ERROR = -32603;

export type JsonRpcId = string | number | null;

/**
 * The JSON value of a raw request body; `undefined` when there is none or
 * it is not JSON (the SDK then answers its own parse error).
 */
export function jsonBodyOf(raw: Buffer | undefined): unknown {
	if (raw === undefined || raw.length === 0) return undefined;
	try {
		return JSON.parse(raw.toString("utf8"));
	} catch {
		return undefined;
	}
}

/** `method` and `id` of a body that is one JSON-RPC request or notification. */
export interface JsonRpcCall {
	readonly method: string;
	readonly id: JsonRpcId;
}

export function jsonRpcCallOf(body: unknown): JsonRpcCall | null {
	if (typeof body !== "object" || body === null || Array.isArray(body)) {
		return null;
	}
	if (!("method" in body) || typeof body.method !== "string") return null;
	const id =
		"id" in body && (typeof body.id === "string" || typeof body.id === "number")
			? body.id
			: null;
	return { method: body.method, id };
}

export function sendJsonRpcError(
	res: Response,
	status: number,
	error: { readonly code: number; readonly message: string },
	id: JsonRpcId = null,
): void {
	res.status(status).json({ jsonrpc: "2.0", id, error });
}

/**
 * Refuses a JSON-RPC batch (a JSON array) with 400 and returns true. MCP
 * removed batching in 2025-06-18, and the SDK's stateless legacy path
 * would run every call of a batch at once, past the per-request rate
 * limits: each HTTP request carries exactly one message here.
 */
export function refuseBatch(res: Response, body: unknown): boolean {
	if (!Array.isArray(body)) return false;
	sendJsonRpcError(res, 400, {
		code: JSON_RPC_INVALID_REQUEST,
		message:
			"Batch requests are not supported: send one JSON-RPC message per HTTP request",
	});
	return true;
}
