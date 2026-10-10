import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { findToast } from "../../test/toast";
import {
	BASE,
	findCreate,
	inboxJson,
	listJson,
	renderInboxTab,
} from "./inbox-test-utils";

describe("inbox form: edit and partial create", () => {
	beforeEach(() => {
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
	});
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("edits the response and stops forwarding", async () => {
		const forwarded = inboxJson("stripe", {
			forward: { port: 3000, path: "/hooks", target: "tunnel:3000/hooks" },
		});
		const { calls } = renderInboxTab(listJson([forwarded]), {
			[`PUT ${BASE}/stripe`]: { body: forwarded },
			[`PUT ${BASE}/stripe/forward`]: { body: inboxJson("stripe") },
		});
		const user = userEvent.setup();
		await user.click(
			await screen.findByRole("button", { name: "Edit inbox stripe" }),
		);
		const dialog = await screen.findByRole("dialog", {
			name: "Edit inbox stripe",
		});
		expect(within(dialog).getByLabelText(/^Name/)).toBeDisabled();
		const types = within(within(dialog).getByLabelText("Content-Type"));
		// JSON or plain text only: an inbox never answers with HTML.
		expect(types.getAllByRole("option").map((o) => o.textContent)).toEqual([
			"application/json",
			"text/plain",
		]);
		await user.selectOptions(
			within(dialog).getByLabelText("Content-Type"),
			"text/plain",
		);
		await user.click(within(dialog).getByRole("switch"));
		await user.click(
			within(dialog).getByRole("button", { name: "Save inbox" }),
		);
		await findToast("Saved inbox stripe.");
		const writes = calls.filter((call) => call.method === "PUT");
		expect(writes.map((call) => call.body)).toEqual([
			{
				response: {
					status: 200,
					contentType: "text/plain",
					body: '{"received":true}',
				},
			},
			{ forward: null },
		]);
	});

	it("keeps the created inbox when forwarding fails, then retries the forward only", async () => {
		let forwardCalls = 0;
		const { calls } = renderInboxTab(listJson([]), {
			[`POST ${BASE}`]: { status: 201, body: inboxJson("gh") },
			[`PUT ${BASE}/gh/forward`]: () => {
				forwardCalls += 1;
				return forwardCalls === 1
					? {
							status: 400,
							body: {
								error: { code: "VALIDATION_ERROR", message: "Bad port." },
							},
						}
					: {
							body: inboxJson("gh", {
								forward: {
									port: 3000,
									path: "/webhooks",
									target: "tunnel:3000/webhooks",
								},
							}),
						};
			},
		});
		const user = userEvent.setup();
		await user.click(await findCreate());
		const dialog = await screen.findByRole("dialog");
		await user.type(within(dialog).getByLabelText(/^Name/), "gh");
		await user.click(within(dialog).getByRole("switch"));
		await user.click(
			within(dialog).getByRole("button", { name: "Create inbox" }),
		);
		expect(
			await within(dialog).findByText(
				/^Created inbox gh, but couldn't turn on forwarding: Bad port\./,
			),
		).toBeInTheDocument();
		expect(within(dialog).getByLabelText(/^Name/)).toBeDisabled();
		await user.click(
			within(dialog).getByRole("button", { name: "Save inbox" }),
		);
		await findToast("Saved inbox gh.");
		expect(calls.filter((call) => call.method === "POST")).toHaveLength(1);
		expect(forwardCalls).toBe(2);
	});
});
