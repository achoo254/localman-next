import { createRequestDraft } from "@localman/shared/api-client";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	byDataId,
	renderWorkbench,
	stubClientApi,
} from "../../features/api-client/workbench/workbench-test-utils";

afterEach(() => vi.unstubAllGlobals());

describe("API client screen", () => {
	it("records each send in history with {{variables}} kept", async () => {
		const calls = stubClientApi([
			{
				tabId: "t1",
				draft: createRequestDraft({ url: "https://a.test/{{id}}" }),
			},
		]);
		renderWorkbench();
		await screen.findByRole("tablist", { name: "Open requests" });
		await userEvent.setup().click(byDataId("request-send"));
		await waitFor(() =>
			expect(calls.find((call) => call.method === "POST")).toMatchObject({
				path: "/api/v1/client/history",
				body: {
					draft: { url: "https://a.test/{{id}}" },
					response: { status: 200, ms: 9, size: 4, route: "proxy" },
				},
			}),
		);
	});

	it("opens requests from the import dialog as tabs", async () => {
		stubClientApi();
		renderWorkbench();
		const user = userEvent.setup();
		await screen.findByText("Drafts saved to your account");
		await user.click(byDataId("editor-empty-import"));
		const dialog = await screen.findByRole("dialog", { name: "Import" });
		await user.click(
			within(dialog).getByRole("textbox", { name: "Content to import" }),
		);
		await user.paste("curl -X PUT https://api.test/items/1");
		await user.click(
			await within(dialog).findByRole("button", { name: "Open 1 request" }),
		);
		expect(
			await screen.findByRole("tab", { name: /api\.test\/items\/1/ }),
		).toHaveAttribute("aria-selected", "true");
		expect(byDataId("request-method")).toHaveValue("PUT");
	});

	it("shows code snippets of the active request", async () => {
		stubClientApi([
			{ tabId: "t1", draft: createRequestDraft({ url: "https://a.test/x" }) },
		]);
		renderWorkbench();
		await screen.findByRole("tablist", { name: "Open requests" });
		fireEvent.click(byDataId("request-head-code"));
		const dialog = await screen.findByRole("dialog");
		expect(dialog).toHaveAttribute("data-id", "modal-code");
		expect(
			within(dialog).getByText(/https:\/\/a\.test\/x/),
		).toBeInTheDocument();
	});
});
