import { describe, expect, it } from "vitest";
import { sampleOperations } from "./__fixtures__/sample-operations.js";
import { isOperationDefinition, renderMcpToolTable } from "./mcp-tool-table.js";

describe("renderMcpToolTable", () => {
	const markdown = renderMcpToolTable(sampleOperations);

	it("groups tools by toolset in TOOLSETS order", () => {
		const mock = markdown.indexOf("## Toolset `mock`");
		const client = markdown.indexOf("## Toolset `client`");
		expect(mock).toBeGreaterThan(-1);
		expect(client).toBeGreaterThan(mock);
		expect(markdown).not.toContain("## Toolset `admin`");
	});

	it("lists tool, operation, route, hints, scopes and confirmation", () => {
		expect(markdown).toContain(
			"| `get_resource` | `mock.getResource` | `GET /projects/:projectId/resources/:resourceId` | read-only, idempotent | `mock:read` | — | Get one mock resource |",
		);
		expect(markdown).toContain(
			"| `delete_project` | `client.deleteProject` | `DELETE /projects/:projectId` | destructive, idempotent | `client:write` | `dry_run` then `confirm_token` | Delete a project |",
		);
	});

	it("lists exempt operations with their reason", () => {
		expect(markdown).toContain(
			"| `client.downloadExtension` | `GET /extension/download` | Browser extension utility; useless to an agent |",
		);
		expect(markdown).not.toContain("`download_extension`");
	});

	it("mentions the default toolsets", () => {
		expect(markdown).toContain("Toolsets enabled by default: `mock`, `client`");
	});
});

describe("isOperationDefinition", () => {
	it("accepts defineOperation output only", () => {
		expect(sampleOperations.every(isOperationDefinition)).toBe(true);
		expect(isOperationDefinition({ id: "mock.x", mcp: true })).toBe(false);
		expect(isOperationDefinition(null)).toBe(false);
	});
});
