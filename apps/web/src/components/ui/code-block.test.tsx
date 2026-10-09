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
			screen.getByRole("button", { name: "Sao chép mã curl" }),
		);
		expect(copyText).toHaveBeenCalledWith(CODE);
		expect(
			await screen.findByRole("button", { name: "Đã sao chép" }),
		).toBeInTheDocument();
		expect(screen.getByRole("status")).toHaveTextContent("Đã sao chép mã");
	});

	it("selects the code for a manual copy when the clipboard refuses", async () => {
		vi.mocked(copyText).mockResolvedValue(false);
		renderBlock();
		await userEvent.click(
			screen.getByRole("button", { name: "Sao chép mã curl" }),
		);
		expect(
			await screen.findByText(/mã đã được chọn để bạn sao chép thủ công/, {
				selector: "p",
			}),
		).toBeInTheDocument();
		expect(window.getSelection()?.toString()).toBe(CODE);
		expect(
			screen.getByRole("button", { name: "Sao chép mã curl" }),
		).toBeInTheDocument();
	});
});
