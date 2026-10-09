/**
 * The "MCP tools" docs page lists the `mock` toolset from static data
 * (the web build cannot load the API registry). This keeps that copy, and
 * the English summaries, equal to what the registry serves.
 */
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { docsMcp } from "../../apps/web/src/i18n/messages/en/docs-mcp.js";
import {
	MOCK_TOOLSET_TOOLS,
	type McpToolDoc,
	type ToolConfirmation,
} from "../../apps/web/src/pages/docs/mcp-tools-data.js";
import {
	isOperationDefinition,
	toMcpToolDescriptor,
} from "../../packages/operations/src/index.js";

const REGISTRY = resolve(
	import.meta.dirname,
	"../../apps/api/src/operations/registry.ts",
);

interface RegistryTool extends McpToolDoc {
	readonly summary: string;
}

/** Tools of the `mock` toolset, in registry order, as the docs list them. */
async function registryMockTools(): Promise<RegistryTool[]> {
	const module: unknown = await import(pathToFileURL(REGISTRY).href);
	const operations =
		typeof module === "object" && module !== null && "operations" in module
			? module.operations
			: undefined;
	if (!Array.isArray(operations)) throw new Error("no `operations` export");
	const tools: RegistryTool[] = [];
	for (const op of operations) {
		if (!isOperationDefinition(op) || op.toolset !== "mock") continue;
		const tool = toMcpToolDescriptor(op);
		if (!tool) continue;
		const confirmation: ToolConfirmation = tool.requiresConfirmation
			? "required"
			: tool.dryRun
				? "optional"
				: "none";
		tools.push({
			tool: tool.name,
			operation: op.id.slice("mock.".length),
			scopes: [...tool.scopes],
			confirmation,
			summary: op.summary ?? tool.description,
		});
	}
	return tools;
}

describe("MCP tools docs page", () => {
	let registry: RegistryTool[] = [];
	beforeAll(async () => {
		registry = await registryMockTools();
	}, 60_000);

	it("lists exactly the mock toolset, in order, with scopes and confirmation", () => {
		expect(registry.length).toBeGreaterThan(0);
		const documented = MOCK_TOOLSET_TOOLS.map((tool) => ({
			tool: tool.tool,
			operation: tool.operation,
			scopes: [...tool.scopes],
			confirmation: tool.confirmation,
		}));
		expect(documented).toEqual(
			registry.map(({ summary: _summary, ...tool }) => tool),
		);
	});

	it("shows the registry's own English summary for every tool", () => {
		const summaries: Record<string, string> = docsMcp.toolSummaries;
		for (const tool of registry) {
			expect(summaries[tool.operation], tool.tool).toBe(tool.summary);
		}
		expect(Object.keys(summaries).sort()).toEqual(
			registry.map((tool) => tool.operation).sort(),
		);
	});
});
