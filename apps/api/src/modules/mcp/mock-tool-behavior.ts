import { OperationError } from "@localman/operations";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { runEndpointBehavior } from "../mock-runtime/mock-behavior.js";
import type { MockTarget } from "../mock-runtime/mock-records.js";
import {
	type EndpointKind,
	enabledEndpoint,
} from "../mock-runtime/render-response.js";
import type { MockToolCall } from "./mock-tool-args.js";
import { toolSuccess } from "./operation-tool-result.js";

/**
 * The endpoint's rules and chaos for a mock tool call, as REST runs them
 * (same `nth` counter, latency, faults and per-project wait cap), or
 * `null` when the tool should run its CRUD. MCP has no per-call headers,
 * so `header` rules never match; `query` rules read the `list_` query
 * arguments and `body` rules the `create_`/`update_` data. A rule answer
 * is the tool result as is (an error result from status 400 on; rule
 * headers are not sent); a fault throws its REST error, which the caller
 * turns into a tool error.
 */
export async function toolBehaviorResult(
	kind: EndpointKind,
	target: MockTarget,
	{ recordId, call }: MockToolCall,
	signal: AbortSignal | undefined,
	charge: (bytes: number) => void,
): Promise<CallToolResult | null> {
	const endpoint = enabledEndpoint(target.resource, kind);
	if (!endpoint) return null;
	const result = await runEndpointBehavior(endpoint, kind, target, recordId, {
		...call,
		headers: null,
		signal,
	});
	switch (result.kind) {
		case "proceed":
			return null;
		case "aborted":
			throw new OperationError(
				499,
				"REQUEST_CANCELLED",
				"The client closed the request",
			);
		case "fault":
			throw result.error;
		case "respond": {
			charge(result.bytes);
			if (result.status < 400) return toolSuccess(result.body);
			return {
				content: [{ type: "text", text: JSON.stringify(result.body) }],
				isError: true,
			};
		}
	}
}
