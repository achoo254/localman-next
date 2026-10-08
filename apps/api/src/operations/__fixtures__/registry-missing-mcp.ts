import { z } from "zod";

/**
 * Registry fixture that bypasses `defineOperation`, as untrusted CI input
 * could: the operation declares no MCP exposure at all.
 */
export const operations: readonly unknown[] = [
	{
		id: "mock.listUsers",
		method: "GET",
		path: "/users",
		summary: "List users",
		input: z.object({}),
		output: z.array(z.object({ id: z.string() })),
		scopes: [],
		annotations: { readOnly: true, destructive: false, idempotent: true },
		toolset: "mock",
		handler: () => [],
	},
];
