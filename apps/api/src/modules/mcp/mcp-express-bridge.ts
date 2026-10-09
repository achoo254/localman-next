import type { McpHttpHandler } from "@modelcontextprotocol/server";
import type { Request, Response } from "express";
import { sendFetchResponse } from "./mcp-fetch-bridge.js";
import { refuseBatch } from "./mcp-json-rpc.js";

/**
 * Headers that describe the Node connection or the raw body, not the MCP
 * exchange: the body reaches the handler already parsed (`parsedBody`).
 */
const SKIPPED_HEADERS: ReadonlySet<string> = new Set([
	"connection",
	"content-length",
	"expect",
	"host",
	"keep-alive",
	"transfer-encoding",
	"upgrade",
]);

function webHeaders(req: Request): Headers {
	const headers = new Headers();
	for (const [name, value] of Object.entries(req.headers)) {
		if (value === undefined || SKIPPED_HEADERS.has(name)) continue;
		for (const one of Array.isArray(value) ? value : [value]) {
			headers.append(name, one);
		}
	}
	return headers;
}

/**
 * Serves one Express request with an SDK HTTP handler (`createMcpHandler`)
 * after `express.json` has parsed the body within the app's limit; the
 * handler gets that body as `parsedBody` (unlike `toFetchRequest`, which
 * reads the raw body itself for apps without that parser). A POST that
 * is not JSON is refused here (415), since its body was never read, and
 * so is a JSON-RPC batch (400, see `refuseBatch`). The exchange is
 * aborted when the client goes away.
 */
export async function serveMcpRequest(
	req: Request,
	res: Response,
	handler: McpHttpHandler,
): Promise<void> {
	if (req.method === "POST" && !req.is("application/json")) {
		res.status(415).json({
			error: {
				code: "UNSUPPORTED_MEDIA_TYPE",
				message: "MCP requests must be JSON (Content-Type: application/json)",
			},
		});
		return;
	}
	if (req.method === "POST" && refuseBatch(res, req.body)) return;
	const aborted = new AbortController();
	res.on("close", () => aborted.abort());
	const url = new URL(
		req.originalUrl,
		`${req.protocol}://${req.get("host") ?? "localhost"}`,
	);
	const request = new globalThis.Request(url, {
		method: req.method,
		headers: webHeaders(req),
		signal: aborted.signal,
	});
	const response = await handler.fetch(
		request,
		req.method === "POST" ? { parsedBody: req.body } : {},
	);
	await sendFetchResponse(response, res);
}
