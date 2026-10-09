import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EXAMPLE_LANGUAGES } from "./code-example";
import { CODE_EXAMPLES, CodeExamplesPage } from "./code-examples-page";
import { EXAMPLE_BASE_URL, MOCK_DOMAIN } from "./docs-pages";

// jsdom does not scroll; the page scrolls to its top when it opens.
beforeEach(() => {
	vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

function renderPage() {
	render(
		<MemoryRouter>
			<CodeExamplesPage />
		</MemoryRouter>,
	);
}

function codeOf(exampleId: string): string {
	const block = document.querySelector(
		`[data-id="docs-example-${exampleId}"] pre`,
	);
	return block?.textContent ?? "";
}

describe("Code examples", () => {
	it("has every example in every language, with nested routes and paging", () => {
		for (const example of CODE_EXAMPLES) {
			for (const { id } of EXAMPLE_LANGUAGES) {
				expect(example.code[id].trim(), `${example.id} ${id}`).not.toBe("");
			}
		}
		expect(EXAMPLE_BASE_URL).toContain(MOCK_DOMAIN);
		const ids = CODE_EXAMPLES.map((example) => example.id);
		expect(ids).toEqual(
			expect.arrayContaining(["crud", "nested", "pagination"]),
		);
		for (const { id } of EXAMPLE_LANGUAGES) {
			const nested = CODE_EXAMPLES.find((e) => e.id === "nested");
			const paging = CODE_EXAMPLES.find((e) => e.id === "pagination");
			expect(nested?.code[id]).toContain("/customers/3/orders");
			expect(paging?.code[id]).toMatch(/page.*2/);
			expect(paging?.code[id]).toMatch(/limit.*10/);
		}
	});

	it("starts in fetch and switches every block to the chosen client", async () => {
		renderPage();
		const fetchButton = screen.getByRole("button", { name: "fetch" });
		expect(fetchButton).toHaveAttribute("aria-pressed", "true");
		expect(codeOf("crud")).toContain("await fetch(");

		await userEvent.click(screen.getByRole("button", { name: "curl" }));
		expect(screen.getByRole("button", { name: "curl" })).toHaveAttribute(
			"aria-pressed",
			"true",
		);
		expect(fetchButton).toHaveAttribute("aria-pressed", "false");
		for (const example of CODE_EXAMPLES) {
			expect(codeOf(example.id)).toBe(example.code.curl);
		}
		expect(screen.getAllByRole("figure", { name: "curl" }).length).toBe(
			CODE_EXAMPLES.length,
		);

		await userEvent.click(screen.getByRole("button", { name: "axios" }));
		expect(codeOf("crud")).toContain("axios.create");
	});
});
