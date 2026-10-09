import { describe, expect, it, vi } from "vitest";
import { connectTestClient, textJson } from "./__fixtures__/mcp-test-client.js";
import { createMemoryToolsetSelectionStore } from "./toolset-selection.js";

async function toolNames(
	client: Awaited<ReturnType<typeof connectTestClient>>["client"],
): Promise<string[]> {
	const { tools } = await client.listTools();
	return tools.map((tool) => tool.name);
}

describe("createOperationMcpServer: toolsets", () => {
	it("enables only the toolsets chosen through ?toolsets=", async () => {
		const { client } = await connectTestClient({ toolsets: ["admin"] });
		const names = await toolNames(client);
		expect(names).toContain("list_audits");
		expect(names).not.toContain("list_widgets");
		expect(names).toContain("list_toolsets");
	});

	it("refuses calls to tools of a disabled toolset", async () => {
		const { client } = await connectTestClient();
		await expect(
			client.callTool({ name: "list_audits", arguments: {} }),
		).rejects.toThrow(/disabled/);
	});

	it("list_toolsets reports toolsets that have tools", async () => {
		const { client } = await connectTestClient();
		const result = await client.callTool({
			name: "list_toolsets",
			arguments: {},
		});
		expect(result.structuredContent).toEqual({
			toolsets: [
				{ name: "mock", enabled: true, tools: 6 },
				{ name: "users", enabled: false, tools: 1 },
				{ name: "admin", enabled: false, tools: 1 },
			],
		});
	});

	it("enable_toolset turns tools on and sends tools/list_changed", async () => {
		const onToolsChanged = vi.fn();
		const { client } = await connectTestClient({ onToolsChanged });
		const changed = new Promise<void>((resolve) => {
			client.setNotificationHandler("notifications/tools/list_changed", () =>
				resolve(),
			);
		});

		const result = await client.callTool({
			name: "enable_toolset",
			arguments: { toolset: "admin" },
		});
		expect(result.isError).toBeFalsy();
		await changed;
		expect(onToolsChanged).toHaveBeenCalledTimes(1);
		expect(await toolNames(client)).toContain("list_audits");
		const audits = await client.callTool({
			name: "list_audits",
			arguments: {},
		});
		expect(audits.structuredContent).toEqual({ entries: ["login"] });

		// Enabling again changes nothing and does not notify.
		await client.callTool({
			name: "enable_toolset",
			arguments: { toolset: "admin" },
		});
		expect(onToolsChanged).toHaveBeenCalledTimes(1);
	});

	it("remembers enabled toolsets for the next server of the same principal", async () => {
		const store = createMemoryToolsetSelectionStore();
		const first = await connectTestClient({
			selection: { store, principalKey: "user-1:agent" },
		});
		await first.client.callTool({
			name: "enable_toolset",
			arguments: { toolset: "admin" },
		});

		const again = await connectTestClient({
			selection: { store, principalKey: "user-1:agent" },
		});
		expect(await toolNames(again.client)).toContain("list_audits");

		const other = await connectTestClient({
			selection: { store, principalKey: "user-2:agent" },
		});
		expect(await toolNames(other.client)).not.toContain("list_audits");
	});

	it("rejects an unknown toolset", async () => {
		const { client } = await connectTestClient();
		const result = await client.callTool({
			name: "enable_toolset",
			arguments: { toolset: "tunnels" },
		});
		expect(result.isError).toBe(true);
		expect(textJson(result)).toMatchObject({
			error: { code: "VALIDATION_ERROR" },
		});
	});
});
