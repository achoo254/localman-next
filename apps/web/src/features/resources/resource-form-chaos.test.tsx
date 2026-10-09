import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ALL_FEATURES } from "../../pages/landing/landing-test-helpers";
import {
	RESOURCES_PATH,
	apiError,
	findNode,
	renderDetail,
	resourceJson,
	sampleTree,
} from "../../pages/project-detail/project-detail-test-helpers";
import { findToast } from "../../test/toast";
import { resetCurrentUserCache } from "../auth/use-current-user";

const USERS_PATH = `${RESOURCES_PATH}/users`;

async function editUsers(put: Parameters<typeof renderDetail>[0][string]) {
	const view = renderDetail(
		{
			[`GET ${RESOURCES_PATH}`]: { body: { items: sampleTree() } },
			[`PUT ${USERS_PATH}`]: put,
		},
		undefined,
		{ flags: ALL_FEATURES },
	);
	const users = await findNode("users");
	await userEvent.click(
		within(users).getByRole("button", { name: "Edit users" }),
	);
	const dialog = await screen.findByRole("dialog", {
		name: "Edit resource · users",
	});
	return { ...view, dialog };
}

async function retype(input: HTMLElement, text: string) {
	await userEvent.clear(input);
	await userEvent.type(input, text);
}

describe("Chaos and rules in the resource form", () => {
	beforeEach(() => resetCurrentUserCache());
	afterEach(() => vi.unstubAllGlobals());

	it("checks chaos before saving it as rates", async () => {
		const { dialog, calls } = await editUsers({ body: resourceJson("users") });
		const toggle = within(dialog).getByRole("button", {
			name: "Chaos for GET /users",
		});
		await userEvent.click(toggle);
		expect(toggle).toHaveAttribute("aria-expanded", "true");
		const panel = within(dialog).getByRole("group", {
			name: "Chaos for GET /users",
		});
		const field = (name: string) =>
			within(panel).getByRole("spinbutton", { name });
		await retype(field("Min delay in milliseconds"), "900");
		await retype(field("Max delay in milliseconds"), "100");
		await retype(field("Error rate in percent"), "60");
		await retype(field("429 rate in percent"), "30");
		await retype(field("Timeout rate in percent"), "20");
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Update" }),
		);
		expect(
			within(panel).getByText("Min can't be more than max."),
		).toBeInTheDocument();
		expect(
			within(panel).getByText(/together can't be over 100%/),
		).toBeInTheDocument();
		expect(calls.some((call) => call.method === "PUT")).toBe(false);

		await retype(field("Max delay in milliseconds"), "1500");
		await retype(field("429 rate in percent"), "0");
		await retype(field("Timeout rate in percent"), "5");
		await userEvent.selectOptions(
			within(panel).getByRole("combobox", { name: "Error status" }),
			"503",
		);
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Update" }),
		);
		expect(await findToast("Updated resource users.")).toBeInTheDocument();
		const body = calls.find((call) => call.method === "PUT")?.body as {
			endpoints: { chaos?: unknown; rules?: unknown }[];
		};
		expect(body.endpoints[0]?.chaos).toEqual({
			latencyMs: [900, 1500],
			errorRate: 0.6,
			errorStatus: 503,
			timeoutRate: 0.05,
			rateLimitRate: 0,
		});
		expect(body.endpoints[1]).not.toHaveProperty("chaos");
		expect(body.endpoints[0]).not.toHaveProperty("rules");
	});

	it("saves a rule and shows the API's refusal on its field", async () => {
		const { dialog, calls } = await editUsers(
			apiError(400, "VALIDATION_ERROR", [
				{ path: "endpoints.0.rules.0.value", message: "Too long" },
			]),
		);
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Rules for GET /users" }),
		);
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Add rule" }),
		);
		await userEvent.type(
			within(dialog).getByRole("textbox", { name: "Header name of rule 1" }),
			"x-role",
		);
		await userEvent.type(
			within(dialog).getByRole("textbox", { name: "Value of rule 1" }),
			"admin",
		);
		await retype(
			within(dialog).getByRole("spinbutton", { name: "Status of rule 1" }),
			"403",
		);
		// Collapsed, the rule shows its summary; the API error opens it again.
		await userEvent.click(
			within(dialog).getByRole("button", { name: /^Rule 1:/ }),
		);
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Update" }),
		);
		expect(
			await within(dialog).findByText("Not accepted: Too long"),
		).toBeInTheDocument();
		expect(
			within(dialog).getByRole("textbox", { name: "Value of rule 1" }),
		).toHaveAttribute("aria-invalid", "true");
		const body = calls.find((call) => call.method === "PUT")?.body as {
			endpoints: { rules?: unknown }[];
		};
		expect(body.endpoints[0]?.rules).toEqual([
			{
				match: { source: "header", key: "x-role" },
				op: "eq",
				value: "admin",
				response: { status: 403, headers: [] },
			},
		]);
	});
});
