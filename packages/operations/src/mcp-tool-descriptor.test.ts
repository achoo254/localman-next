import { describe, expect, it } from "vitest";
import {
	createResource,
	deleteProject,
	downloadExtension,
	getResource,
} from "./__fixtures__/sample-operations.js";
import { toMcpToolDescriptor, toolNameOf } from "./mcp-tool-descriptor.js";

describe("toMcpToolDescriptor", () => {
	it("derives snake_case tool names from operation ids", () => {
		expect(toolNameOf("mock.listResources")).toBe("list_resources");
		expect(toolNameOf("mock-advanced.setRule2Status")).toBe("set_rule2_status");
	});

	it("builds a descriptor with JSON Schema input and hints", () => {
		const tool = toMcpToolDescriptor(getResource);
		expect(tool).not.toBeNull();
		expect(tool?.name).toBe("get_resource");
		expect(tool?.description).toBe(
			"Get one mock resource\n\nReturns a resource of a mock project.",
		);
		expect(tool?.toolset).toBe("mock");
		expect(tool?.dryRun).toBe(false);
		expect(tool?.annotations).toEqual({
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
		});
		expect(tool?.inputSchema).toMatchObject({
			type: "object",
			required: ["projectId", "resourceId"],
			properties: {
				projectId: { type: "string", minLength: 1 },
				expand: { type: "string", enum: ["schema", "none"] },
			},
		});
		expect(tool?.inputSchema).not.toHaveProperty("$schema");
	});

	it("describes inputs as the caller sends them, keeping defaults optional", () => {
		const tool = toMcpToolDescriptor(createResource);
		expect(tool?.inputSchema.required).toEqual(["projectId", "name"]);
		expect(tool?.inputSchema.properties?.count).toMatchObject({ default: 10 });
	});

	it("marks destructive tools and their dry-run support", () => {
		const tool = toMcpToolDescriptor(deleteProject);
		expect(tool?.annotations.destructiveHint).toBe(true);
		expect(tool?.dryRun).toBe(true);
	});

	it("emits no tool for exempt operations", () => {
		expect(toMcpToolDescriptor(downloadExtension)).toBeNull();
	});
});
