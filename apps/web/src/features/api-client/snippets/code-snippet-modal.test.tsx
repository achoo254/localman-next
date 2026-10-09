import type { PreparedRequest } from "@localman/shared/api-client";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { copyText } from "../../../platform/clipboard";
import { seriousViolations } from "../../../test/axe";
import { CodeSnippetModal } from "./code-snippet-modal";

vi.mock("../../../platform/clipboard", () => ({ copyText: vi.fn() }));

const REQUEST: PreparedRequest = {
	method: "POST",
	url: "https://api.test/users",
	headers: [
		{ name: "Authorization", value: "Bearer s3cret" },
		{ name: "Content-Type", value: "application/json" },
	],
	body: { kind: "text", text: '{"name":"Ada"}' },
	secretsUsed: ["token"],
	unresolved: [],
};

function renderModal(request: PreparedRequest | null = REQUEST) {
	render(<CodeSnippetModal open onOpenChange={vi.fn()} request={request} />);
	return screen.getByRole("dialog", { name: "Code snippet" });
}

const output = () =>
	document.querySelector('[data-id="modal-code-output"] code');

describe("CodeSnippetModal", () => {
	beforeEach(() => {
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
	});
	afterEach(() => vi.restoreAllMocks());

	it("shows cURL first and copies the code", async () => {
		vi.mocked(copyText).mockResolvedValue(true);
		const dialog = renderModal();
		expect(
			within(dialog).getByRole("combobox", { name: "Language" }),
		).toHaveFocus();
		const code = output()?.textContent ?? "";
		expect(code).toContain("curl");
		expect(code).toContain("https://api.test/users");
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Copy cURL code" }),
		);
		expect(copyText).toHaveBeenCalledWith(code);
		expect(await seriousViolations(dialog)).toEqual([]);
	});

	it("switches language and warns about secret values", async () => {
		const dialog = renderModal();
		await userEvent.selectOptions(
			within(dialog).getByRole("combobox", { name: "Language" }),
			"python-requests",
		);
		expect(output()?.textContent).toContain("import requests");
		expect(
			dialog.querySelector('[data-id="modal-code-secrets"]'),
		).toHaveTextContent("token");
	});

	it("says when there is nothing to generate", () => {
		const dialog = renderModal(null);
		expect(within(dialog).getByRole("alert")).toHaveTextContent(
			"Couldn't generate code",
		);
	});
});
