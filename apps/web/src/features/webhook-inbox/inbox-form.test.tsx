import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { findToast } from "../../test/toast";
import {
	BASE,
	byId,
	findCreate,
	inboxJson,
	listJson,
	renderInboxTab,
} from "./inbox-test-utils";

describe("inbox form", () => {
	beforeEach(() => {
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
	});
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("creates an inbox, then turns on its forwarding", async () => {
		const { calls } = renderInboxTab(listJson([]), {
			[`POST ${BASE}`]: { status: 201, body: inboxJson("github") },
			[`PUT ${BASE}/github/forward`]: {
				body: inboxJson("github", {
					forward: { port: 4000, path: "/gh", target: "tunnel:4000/gh" },
				}),
			},
		});
		const user = userEvent.setup();
		await user.click(await findCreate());
		const dialog = await screen.findByRole("dialog", {
			name: "Create webhook inbox",
		});
		await user.type(within(dialog).getByLabelText(/^Name/), "github");
		expect(byId("inbox-form-url-preview")).toHaveTextContent(
			"https://secretp1.mock.localman.test/_inbox/github",
		);
		await user.click(within(dialog).getByRole("switch"));
		const port = within(dialog).getByLabelText("Port");
		await user.clear(port);
		await user.type(port, "4000");
		const path = within(dialog).getByLabelText("Path");
		await user.clear(path);
		await user.type(path, "/gh");
		expect(byId("inbox-form-forward-target")).toHaveTextContent(
			"tunnel:4000/gh",
		);
		await user.click(
			within(dialog).getByRole("button", { name: "Create inbox" }),
		);
		await findToast("Created inbox github.");
		const writes = calls.filter((call) => call.method !== "GET");
		expect(writes.map((call) => `${call.method} ${call.path}`)).toEqual([
			`POST ${BASE}`,
			`PUT ${BASE}/github/forward`,
		]);
		expect(writes[0]?.body).toEqual({
			name: "github",
			response: {
				status: 200,
				contentType: "application/json",
				body: '{"received":true}',
			},
		});
		expect(writes[1]?.body).toEqual({ forward: { port: 4000, path: "/gh" } });
	});

	it("opens the plans when the API refuses past the limit", async () => {
		const { onPlanLimit } = renderInboxTab(listJson([]), {
			[`POST ${BASE}`]: {
				status: 403,
				body: {
					error: {
						code: "PLAN_LIMIT_REACHED",
						message: "Limit",
						details: { limit: "webhookInboxes", max: 2, used: 2 },
					},
				},
			},
		});
		const user = userEvent.setup();
		await user.click(await findCreate());
		const dialog = await screen.findByRole("dialog");
		await user.type(within(dialog).getByLabelText(/^Name/), "late");
		await user.click(
			within(dialog).getByRole("button", { name: "Create inbox" }),
		);
		await vi.waitFor(() => expect(onPlanLimit).toHaveBeenCalledTimes(1));
	});

	it("keeps the form and marks the name when it is taken", async () => {
		renderInboxTab(listJson([]), {
			[`POST ${BASE}`]: {
				status: 409,
				body: { error: { code: "INBOX_NAME_TAKEN", message: "Taken" } },
			},
		});
		const user = userEvent.setup();
		await user.click(await findCreate());
		const dialog = await screen.findByRole("dialog");
		const name = within(dialog).getByLabelText(/^Name/);
		await user.type(name, "stripe");
		await user.click(
			within(dialog).getByRole("button", { name: "Create inbox" }),
		);
		expect(
			await within(dialog).findByText(
				"This project already has an inbox with this name.",
			),
		).toBeInTheDocument();
		expect(name).toHaveAttribute("aria-invalid", "true");
		expect(name).toHaveValue("stripe");
	});

	it("checks the name and the status before sending", async () => {
		const { calls } = renderInboxTab(listJson([]));
		const user = userEvent.setup();
		await user.click(await findCreate());
		const dialog = await screen.findByRole("dialog");
		await user.type(within(dialog).getByLabelText(/^Name/), "-bad");
		const status = within(dialog).getByLabelText("Status");
		await user.clear(status);
		await user.type(status, "150");
		await user.click(
			within(dialog).getByRole("button", { name: "Create inbox" }),
		);
		expect(
			within(dialog).getByText(
				"Use lowercase letters, digits and -, not at the start or end.",
			),
		).toBeInTheDocument();
		expect(
			within(dialog).getByText(
				"Status must be a whole number from 200 to 599.",
			),
		).toBeInTheDocument();
		expect(calls.filter((call) => call.method === "POST")).toEqual([]);
	});
});
