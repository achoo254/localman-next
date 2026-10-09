import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { McpConfigSnippets } from "./mcp-config-snippets";
import type { McpTarget } from "./mcp-snippets";
import { McpTryPanel } from "./mcp-try-panel";

const OPEN: McpTarget = {
	serverName: "localman-shop",
	url: "https://a1b2.localman.test/mcp",
	tokenEnv: null,
};
const GUARDED: McpTarget = { ...OPEN, tokenEnv: "LOCALMAN_MCP_TOKEN_SHOP" };

const hint = (id: string) => document.querySelector(`[data-id="${id}"]`);

describe("shell note of commands that read the token", () => {
	it("tells PowerShell and cmd users how to read the variable", () => {
		render(<McpTryPanel id="try" hidden={false} target={GUARDED} />);
		const note = hint("project-detail-mcp-try-shell");
		expect(note).toHaveTextContent("bash/zsh ($LOCALMAN_MCP_TOKEN_SHOP)");
		expect(note).toHaveTextContent("$env:LOCALMAN_MCP_TOKEN_SHOP");
		expect(note).toHaveTextContent("%LOCALMAN_MCP_TOKEN_SHOP%");
	});

	it("is left out when no token is required", () => {
		render(<McpTryPanel id="try" hidden={false} target={OPEN} />);
		expect(hint("project-detail-mcp-try-shell")).toBeNull();
	});

	it("follows the Claude Code command only, not the JSON configs", async () => {
		render(<McpConfigSnippets target={GUARDED} tokenMode="on" />);
		expect(hint("project-detail-mcp-config-shell")).toHaveTextContent(
			"$env:LOCALMAN_MCP_TOKEN_SHOP",
		);
		await userEvent.click(screen.getByRole("button", { name: "Cursor" }));
		expect(hint("project-detail-mcp-config-shell")).toBeNull();
	});
});
