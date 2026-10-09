import type { CallToolResult } from "@modelcontextprotocol/client";

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** TEST ONLY. Structured content of a successful call; throws otherwise. */
export function structuredOf(result: CallToolResult): Record<string, unknown> {
	const first = result.content[0];
	const text = first?.type === "text" ? first.text : "";
	if (result.isError) throw new Error(`Tool failed: ${text}`);
	if (!isRecord(result.structuredContent)) throw new Error("No structure");
	return result.structuredContent;
}
