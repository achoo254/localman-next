import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FeaturesContext, NO_FEATURES } from "../../config/features";
import { setActiveTranslator } from "../../i18n/active-translator";
import { I18nProvider } from "../../i18n/i18n-provider";
import { en } from "../../i18n/messages/en/dictionary";
import { vi as viMessages } from "../../i18n/messages/vi/dictionary";
import { createTranslator } from "../../i18n/translate";
import { LOCALMAN_MCP_URL } from "./docs-pages";
import { MOCK_TOOLSET_TOOLS } from "./mcp-tools-data";
import { McpToolsPage } from "./mcp-tools-page";

beforeEach(() => {
	vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
});
afterEach(() => {
	vi.restoreAllMocks();
	setActiveTranslator(createTranslator("en", en));
});

function renderPage(vietnamese = false) {
	const page = (
		<MemoryRouter>
			<FeaturesContext value={{ ...NO_FEATURES, mockMcp: true }}>
				<McpToolsPage />
			</FeaturesContext>
		</MemoryRouter>
	);
	return render(
		vietnamese ? (
			<I18nProvider initial={{ locale: "vi", messages: viMessages }}>
				{page}
			</I18nProvider>
		) : (
			page
		),
	);
}

describe("MCP tools docs page", () => {
	it("lists every tool of the mock toolset with its scopes and confirmation", () => {
		renderPage();
		const table = screen.getByRole("table", {
			name: "Tools of the mock toolset",
		});
		const rows = within(table).getAllByRole("row").slice(1);
		expect(rows.map((row) => row.querySelector("code")?.textContent)).toEqual(
			MOCK_TOOLSET_TOOLS.map((tool) => tool.tool),
		);
		const confirmed = MOCK_TOOLSET_TOOLS.filter(
			(tool) => tool.confirmation === "required",
		);
		expect(confirmed).toHaveLength(6);
		expect(
			screen.getByText(/^6 tools change or delete a lot at once/),
		).toBeInTheDocument();
		const deleteRow = rows.find((row) =>
			row.textContent?.startsWith("delete_project"),
		);
		expect(deleteRow).toHaveTextContent("dry_run, then confirm_token");
		expect(deleteRow).toHaveTextContent(
			"Delete a mock project and everything in it",
		);
	});

	it("shows how to add Localman MCP to Claude Code and Cursor", () => {
		renderPage();
		const claude = document.querySelector('[data-id="docs-mcp-claude"] pre');
		expect(claude?.textContent).toBe(
			`claude mcp add --transport http localman ${LOCALMAN_MCP_URL}`,
		);
		const cursor = document.querySelector('[data-id="docs-mcp-cursor"] pre');
		expect(JSON.parse(cursor?.textContent ?? "")).toEqual({
			mcpServers: { localman: { url: LOCALMAN_MCP_URL } },
		});
		expect(screen.getByText("mock://schema")).toBeInTheDocument();
		expect(screen.getByText("auth.hoandat.com")).toBeInTheDocument();
	});

	it("follows the chosen language, keeping technical terms and code", () => {
		renderPage(true);
		expect(
			screen.getByRole("heading", { level: 2, name: "Tool của Localman MCP" }),
		).toBeInTheDocument();
		expect(document.title).toBe("MCP tools · Tài liệu Localman");
		expect(
			screen.getByText(/^6 tool thay đổi hoặc xoá nhiều dữ liệu/),
		).toBeInTheDocument();
		expect(
			document.querySelector('[data-id="docs-mcp-claude"] pre')?.textContent,
		).toContain("claude mcp add");
	});
});
