import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { copyText } from "../../platform/clipboard";
import { CodeBlock } from "./code-block";

vi.mock("../../platform/clipboard", () => ({ copyText: vi.fn() }));

const CODE = 'curl "$BASE_URL/customers"\ncurl "$BASE_URL/customers/1"';

function renderBlock() {
	render(<CodeBlock caption="curl" code={CODE} data-id="example" />);
}

describe("CodeBlock", () => {
	afterEach(() => vi.mocked(copyText).mockReset());

	it("shows the code in a labelled figure", () => {
		renderBlock();
		const figure = screen.getByRole("figure", { name: "curl" });
		expect(figure.querySelector("pre code")?.textContent).toBe(CODE);
	});

	it("copies the whole snippet and announces it", async () => {
		vi.mocked(copyText).mockResolvedValue(true);
		renderBlock();
		await userEvent.click(
			screen.getByRole("button", { name: "Copy curl code" }),
		);
		expect(copyText).toHaveBeenCalledWith(CODE);
		expect(
			await screen.findByRole("button", { name: "Copied" }),
		).toBeInTheDocument();
		expect(screen.getByRole("status")).toHaveTextContent("Code copied");
	});

	it("selects the code for a manual copy when the clipboard refuses", async () => {
		vi.mocked(copyText).mockResolvedValue(false);
		renderBlock();
		await userEvent.click(
			screen.getByRole("button", { name: "Copy curl code" }),
		);
		expect(
			await screen.findByText(
				/The code is selected so you can copy it yourself/,
				{
					selector: "p",
				},
			),
		).toBeInTheDocument();
		expect(window.getSelection()?.toString()).toBe(CODE);
		expect(
			screen.getByRole("button", { name: "Copy curl code" }),
		).toBeInTheDocument();
	});

	it("wraps long lines only when asked, keeping the copied text one line", () => {
		const command = `claude mcp add --transport http demo ${"x".repeat(120)}`;
		render(
			<CodeBlock caption="Terminal" code={command} wrap data-id="wrapped" />,
		);
		render(<CodeBlock caption="JSON" code="{}" data-id="scrolled" />);
		const wrapped = document.querySelector('[data-id="wrapped"] pre');
		expect(wrapped).toHaveClass("whitespace-pre-wrap", "wrap-anywhere");
		expect(wrapped?.textContent).toBe(command);
		expect(document.querySelector('[data-id="scrolled"] pre')).not.toHaveClass(
			"whitespace-pre-wrap",
		);
	});
});
