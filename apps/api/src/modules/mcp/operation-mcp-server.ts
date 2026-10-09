import {
	type AnyOperation,
	DEFAULT_TOOLSETS,
	type Toolset,
	assertNoOperationConflicts,
	toolNameOf,
} from "@localman/operations";
import { McpServer, type RegisteredTool } from "@modelcontextprotocol/server";
import {
	type OperationToolDeps,
	registerOperationTool,
} from "./operation-tool.js";
import type { ToolsetSelectionStore } from "./toolset-selection.js";
import {
	ENABLE_TOOLSET_TOOL,
	LIST_TOOLSETS_TOOL,
	registerToolsetTools,
} from "./toolset-tools.js";

export interface OperationMcpServerOptions extends OperationToolDeps {
	readonly serverInfo: { readonly name: string; readonly version: string };
	/** Operations to expose; those with `mcp: { exempt }` are skipped. */
	readonly operations: readonly AnyOperation[];
	/** Toolsets from `?toolsets=` (`parseToolsetsParam`); defaults when omitted. */
	readonly toolsets?: readonly Toolset[];
	/**
	 * Keeps `enable_toolset` choices across requests: over Streamable HTTP
	 * every request builds a new server. Key it by principal (e.g. user
	 * and OAuth client), never by a client-chosen value.
	 */
	readonly selection?: {
		readonly store: ToolsetSelectionStore;
		readonly principalKey: string;
	};
	/** Called when `enable_toolset` changed the list; over HTTP wire it to `handler.notify.toolsChanged()`. */
	readonly onToolsChanged?: () => void;
}

const META_TOOLS = [LIST_TOOLSETS_TOOL, ENABLE_TOOLSET_TOOL];

function assertNoMetaToolClash(operations: readonly AnyOperation[]): void {
	for (const op of operations) {
		if (op.mcp === true && META_TOOLS.includes(toolNameOf(op.id))) {
			throw new Error(
				`Operation "${op.id}" clashes with the MCP meta-tool "${toolNameOf(op.id)}"`,
			);
		}
	}
}

/**
 * Builds an MCP server whose tools are the registry's operations (one per
 * operation with `mcp: true`), grouped in toolsets. Tools outside the
 * enabled toolsets are registered but disabled, so `enable_toolset` can
 * turn them on and send `notifications/tools/list_changed`. Build one per
 * HTTP request (stateless) or per connection.
 */
export function createOperationMcpServer(
	options: OperationMcpServerOptions,
): McpServer {
	const { operations, selection } = options;
	assertNoOperationConflicts(operations);
	assertNoMetaToolClash(operations);

	const server = new McpServer(options.serverInfo);
	const toolsByToolset = new Map<Toolset, RegisteredTool[]>();
	for (const op of operations) {
		const tool = registerOperationTool(server, op, options);
		if (!tool) continue;
		const group = toolsByToolset.get(op.toolset) ?? [];
		group.push(tool);
		toolsByToolset.set(op.toolset, group);
	}

	const enabled = new Set<Toolset>([
		...(options.toolsets ?? DEFAULT_TOOLSETS),
		...(selection?.store.get(selection.principalKey) ?? []),
	]);
	for (const [toolset, tools] of toolsByToolset) {
		if (enabled.has(toolset)) continue;
		// Set the flag rather than call disable(): nothing to notify yet.
		for (const tool of tools) tool.enabled = false;
	}

	registerToolsetTools(server, {
		toolsByToolset,
		enabled,
		remember: (toolset) =>
			selection?.store.add(selection.principalKey, toolset),
		onToolsChanged: () => options.onToolsChanged?.(),
		logger: options.logger,
	});
	return server;
}
