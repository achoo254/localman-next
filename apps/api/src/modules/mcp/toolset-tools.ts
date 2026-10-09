import {
	type JsonSchema,
	OperationError,
	TOOLSETS,
	type Toolset,
} from "@localman/operations";
import type { McpServer, RegisteredTool } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { Logger } from "../../logger.js";
import { toolFailure, toolSuccess } from "./operation-tool-result.js";
import { advertisedSchema } from "./operation-tool-schema.js";

export const LIST_TOOLSETS_TOOL = "list_toolsets";
export const ENABLE_TOOLSET_TOOL = "enable_toolset";

export interface ToolsetToolsOptions {
	/** Registered operation tools of each toolset that has any. */
	readonly toolsByToolset: ReadonlyMap<Toolset, readonly RegisteredTool[]>;
	/** Mutated by `enable_toolset`. */
	readonly enabled: Set<Toolset>;
	/** Persists the choice for later requests of the same principal. */
	readonly remember: (toolset: Toolset) => void;
	/** Tells listening clients that `tools/list` changed. */
	readonly onToolsChanged: () => void;
	readonly logger: Logger;
}

function outputJsonSchema(schema: z.ZodType): JsonSchema {
	const { $schema: _dialect, ...rest } = z.toJSONSchema(schema, {
		io: "output",
	});
	return rest;
}

const toolsetsOutput = z.object({
	toolsets: z.array(
		z.object({
			name: z.string(),
			enabled: z.boolean(),
			tools: z.number().int(),
		}),
	),
});

/**
 * Registers `list_toolsets` and `enable_toolset`. Only toolsets that have
 * at least one tool are offered.
 */
export function registerToolsetTools(
	server: McpServer,
	options: ToolsetToolsOptions,
): void {
	const { toolsByToolset, enabled } = options;
	const available = TOOLSETS.filter((name) => toolsByToolset.has(name));

	const summary = () => ({
		toolsets: available.map((name) => ({
			name,
			enabled: enabled.has(name),
			tools: toolsByToolset.get(name)?.length ?? 0,
		})),
	});

	server.registerTool(
		LIST_TOOLSETS_TOOL,
		{
			title: "List toolsets",
			description:
				"Lists the groups of Localman tools (mock, client, admin, ...) with how many tools each has and whether it is enabled. Enable more with enable_toolset.",
			inputSchema: advertisedSchema({ type: "object", properties: {} }),
			outputSchema: advertisedSchema(outputJsonSchema(toolsetsOutput)),
			annotations: {
				readOnlyHint: true,
				destructiveHint: false,
				idempotentHint: true,
				openWorldHint: false,
			},
		},
		() => toolSuccess(summary()),
	);

	const enableInput: JsonSchema = {
		type: "object",
		properties: {
			toolset: {
				type: "string",
				enum: [...available],
				description: "Name from list_toolsets",
			},
		},
		required: ["toolset"],
		additionalProperties: false,
	};
	const toolsetArg = (args: Record<string, unknown>): Toolset => {
		const toolset = available.find((name) => name === args.toolset);
		if (!toolset) {
			throw new OperationError(
				400,
				"VALIDATION_ERROR",
				`"toolset" must be one of: ${available.join(", ")}`,
			);
		}
		return toolset;
	};
	server.registerTool(
		ENABLE_TOOLSET_TOOL,
		{
			title: "Enable a toolset",
			description:
				"Turns on every tool of one toolset (see list_toolsets). The tool list changes; clients that listen are notified.",
			inputSchema: advertisedSchema(enableInput),
			outputSchema: advertisedSchema(outputJsonSchema(toolsetsOutput)),
			annotations: {
				readOnlyHint: false,
				destructiveHint: false,
				idempotentHint: true,
				openWorldHint: false,
			},
		},
		(args) => {
			try {
				const toolset = toolsetArg(args);
				if (!enabled.has(toolset)) {
					enabled.add(toolset);
					// Flip the flag directly so the client gets one
					// list_changed instead of one per tool.
					for (const tool of toolsByToolset.get(toolset) ?? []) {
						tool.enabled = true;
					}
					options.remember(toolset);
					server.sendToolListChanged();
					options.onToolsChanged();
				}
				return toolSuccess(summary());
			} catch (error) {
				return toolFailure(error, ENABLE_TOOLSET_TOOL, options.logger);
			}
		},
	);
}
