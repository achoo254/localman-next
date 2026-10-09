import { describe, expect, it } from "vitest";
import {
	INSPECTOR_PACKAGE,
	MCP_CONFIG_FORMATS,
	type McpTarget,
	claudeAddCommand,
	cursorConfig,
	genericMcpConfig,
	inspectorCliCommand,
	inspectorCommand,
	mcpConfigSnippet,
	mcpEndpointUrl,
	mcpProjectSlug,
	mcpServerName,
	mcpTokenEnvVar,
} from "./mcp-snippets";

const URL = "https://a1b2.localman.test/api/v1/mcp";
const OPEN: McpTarget = {
	serverName: "localman-shop",
	url: URL,
	tokenEnv: null,
};
const GUARDED: McpTarget = { ...OPEN, tokenEnv: "LOCALMAN_MCP_TOKEN_SHOP" };

describe("names", () => {
	it.each([
		["Cửa hàng", "cua-hang"],
		["Đồ ăn  & uống!!", "do-an-uong"],
		["  --Shop API--  ", "shop-api"],
		["日本", ""],
	])("slugs %j as %j", (name, slug) => {
		expect(mcpProjectSlug(name)).toBe(slug);
	});

	it("cuts the slug at 40 characters without a trailing dash", () => {
		const slug = mcpProjectSlug(`${"a".repeat(39)} b`);
		expect(slug).toBe("a".repeat(39));
	});

	it("names the server and the token variable after the project", () => {
		expect(mcpServerName("Cửa hàng")).toBe("localman-cua-hang");
		expect(mcpTokenEnvVar("Cửa hàng")).toBe("LOCALMAN_MCP_TOKEN_CUA_HANG");
		expect(mcpServerName("日本")).toBe("localman-mock");
		expect(mcpTokenEnvVar("日本")).toBe("LOCALMAN_MCP_TOKEN_MOCK");
	});

	it("appends /mcp to the mock base URL", () => {
		expect(mcpEndpointUrl("https://a1b2.localman.test/api/v1")).toBe(URL);
		expect(mcpEndpointUrl("https://a1b2.localman.test/")).toBe(
			"https://a1b2.localman.test/mcp",
		);
	});
});

describe("snippets", () => {
	it("adds the server to Claude Code in one line", () => {
		expect(claudeAddCommand(OPEN)).toBe(
			`claude mcp add --transport http localman-shop ${URL}`,
		);
		expect(claudeAddCommand(GUARDED)).toBe(
			`claude mcp add --transport http localman-shop ${URL} --header "Authorization: Bearer $LOCALMAN_MCP_TOKEN_SHOP"`,
		);
	});

	it("writes Cursor and generic JSON with each client's variable syntax", () => {
		expect(JSON.parse(cursorConfig(OPEN))).toEqual({
			mcpServers: { "localman-shop": { url: URL } },
		});
		expect(JSON.parse(cursorConfig(GUARDED))).toEqual({
			mcpServers: {
				"localman-shop": {
					url: URL,
					headers: {
						Authorization: "Bearer ${env:LOCALMAN_MCP_TOKEN_SHOP}",
					},
				},
			},
		});
		expect(JSON.parse(genericMcpConfig(GUARDED))).toEqual({
			mcpServers: {
				"localman-shop": {
					type: "http",
					url: URL,
					headers: { Authorization: "Bearer ${LOCALMAN_MCP_TOKEN_SHOP}" },
				},
			},
		});
	});

	it("runs MCP Inspector v2 with the header last and --cli first", () => {
		expect(inspectorCommand(GUARDED)).toBe(
			`npx -y ${INSPECTOR_PACKAGE} --transport http --server-url ${URL} --header "Authorization: Bearer $LOCALMAN_MCP_TOKEN_SHOP"`,
		);
		expect(inspectorCliCommand(OPEN)).toBe(
			`npx -y ${INSPECTOR_PACKAGE} --cli --transport http --server-url ${URL} --method tools/list`,
		);
	});

	it("never contains a token, only the variable name", () => {
		for (const format of MCP_CONFIG_FORMATS) {
			const snippet = mcpConfigSnippet(format, GUARDED);
			expect(snippet).toContain("LOCALMAN_MCP_TOKEN_SHOP");
			expect(snippet).not.toMatch(/lmmcp_/);
			expect(mcpConfigSnippet(format, OPEN)).not.toMatch(/Authorization/);
		}
	});
});
