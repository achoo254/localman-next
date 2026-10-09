import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ALL_FEATURES } from "../../pages/landing/landing-test-helpers";
import {
	RESOURCES_PATH,
	findNode,
	openNewResource,
	renderDetail,
	resourceJson,
	sampleTree,
} from "../../pages/project-detail/project-detail-test-helpers";
import { resetCurrentUserCache } from "../auth/use-current-user";

const items = { [`GET ${RESOURCES_PATH}`]: { body: { items: sampleTree() } } };
const suggestedNotes = () =>
	document.querySelectorAll('[data-id$="-suggested"]').length;

async function addField(dialog: HTMLElement, name: string) {
	await userEvent.click(
		within(dialog).getByRole("button", { name: "Add field" }),
	);
	const input = within(dialog).getByRole("textbox", { name: "Field name 4" });
	await userEvent.type(input, name);
	await userEvent.tab();
	return input;
}

describe("Faker suggestions and the mockPowerUps flag in the resource form", () => {
	beforeEach(() => resetCurrentUserCache());
	afterEach(() => vi.unstubAllGlobals());

	it("suggests a method from the name until the user picks one", async () => {
		renderDetail(items, undefined, { flags: ALL_FEATURES });
		const dialog = await openNewResource();
		// Default fields come with their method: nothing is suggested.
		expect(suggestedNotes()).toBe(0);
		const input = await addField(dialog, "email");
		const method = within(dialog).getByRole("combobox", {
			name: "Faker method of email",
		});
		expect(method).toHaveValue("internet.email");
		const note = dialog.querySelector(
			'[data-id="resource-form-field-4-suggested"]',
		);
		expect(note).toHaveTextContent(/suggested\s*from the field name/);
		expect(method.getAttribute("aria-describedby")).toBe(note?.id);

		await userEvent.click(method);
		await userEvent.type(method, "lorem.slug{Enter}");
		expect(method).toHaveValue("lorem.slug");
		expect(suggestedNotes()).toBe(0);
		await userEvent.clear(input);
		await userEvent.type(input, "photoUrl");
		await userEvent.tab();
		expect(
			within(dialog).getByRole("combobox", {
				name: "Faker method of photoUrl",
			}),
		).toHaveValue("lorem.slug");
	});

	it("re-suggests a saved field only once it is renamed", async () => {
		renderDetail(items, undefined, { flags: ALL_FEATURES });
		await userEvent.click(
			within(await findNode("likes")).getByRole("button", {
				name: "Edit likes",
			}),
		);
		const dialog = await screen.findByRole("dialog", {
			name: "Edit resource · likes",
		});
		const name = within(dialog).getByRole("textbox", { name: "Field name 1" });
		await userEvent.click(name);
		await userEvent.tab();
		expect(suggestedNotes()).toBe(0);
		await userEvent.clear(name);
		await userEvent.type(name, "userEmail");
		await userEvent.tab();
		expect(
			within(dialog).getByRole("combobox", {
				name: "Faker method of userEmail",
			}),
		).toHaveValue("internet.email");
		expect(
			within(dialog).getByRole("button", { name: "Export types" }),
		).toBeInTheDocument();
	});

	it("shows saved rules and chaos collapsed with a summary", async () => {
		const users = resourceJson("users");
		const endpoints = [
			{
				method: "GET",
				path: "/:res",
				enabled: true,
				response: "$mockData",
				chaos: {
					latencyMs: [0, 800],
					errorRate: 0.1,
					errorStatus: 500,
					timeoutRate: 0,
					rateLimitRate: 0,
				},
				rules: [
					{
						match: { source: "nth" },
						op: "gt",
						value: 3,
						response: { status: 429, headers: [] },
					},
				],
			},
		];
		renderDetail(
			{
				[`GET ${RESOURCES_PATH}`]: {
					body: { items: [{ ...users, endpoints }] },
				},
			},
			undefined,
			{ flags: ALL_FEATURES },
		);
		await userEvent.click(
			within(await findNode("users")).getByRole("button", {
				name: "Edit users",
			}),
		);
		const dialog = await screen.findByRole("dialog", {
			name: "Edit resource · users",
		});
		expect(
			within(dialog).getByText("0–800 ms · 10% errors (500)"),
		).toBeInTheDocument();
		const rules = within(dialog).getByRole("button", {
			name: "Rules for GET /users",
		});
		expect(rules).toHaveTextContent("Rules · 1");
		await userEvent.click(rules);
		expect(
			within(dialog).getByRole("button", {
				name: "Rule 1: request number is greater than 3 → 429",
			}),
		).toHaveAttribute("aria-expanded", "false");
	});

	it("hides every power-up while the flag is off", async () => {
		renderDetail(items);
		const users = await findNode("users");
		expect(screen.queryByRole("button", { name: "Import" })).toBeNull();
		expect(
			within(users).queryByRole("button", { name: "Export types of users" }),
		).toBeNull();
		const dialog = await openNewResource();
		await addField(dialog, "email");
		await new Promise((resolve) => setTimeout(resolve, 500));
		expect(suggestedNotes()).toBe(0);
		expect(
			within(dialog).getByRole("combobox", { name: "Faker method of email" }),
		).toHaveValue("lorem.word");
		expect(
			within(dialog).queryByRole("button", { name: /^Rules for/ }),
		).toBeNull();
		expect(
			within(dialog).queryByRole("button", { name: /^Chaos for/ }),
		).toBeNull();
		expect(dialog).not.toHaveTextContent(/chaos|Export types/i);
	});
});
