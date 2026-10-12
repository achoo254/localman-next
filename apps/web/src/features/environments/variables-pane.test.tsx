import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	ACTIVE,
	ENV_PATH,
	GLOBALS,
	LIST,
	environment,
	renderEnvironments,
	summary,
	variable,
} from "./environments-test-utils";

afterEach(() => vi.unstubAllGlobals());

const ACTIVE_E1 = { body: { workspaceId: "w-team", environmentId: "e1" } };

async function openPane(user = userEvent.setup()) {
	await user.click(
		await screen.findByRole("button", { name: "Quick look at variables" }),
	);
	return screen.findByRole("dialog", { name: "Variables" });
}

const rowOf = (key: string): HTMLElement => {
	const row = document.querySelector<HTMLElement>(
		`[data-id="vars-quick-row"][data-key="${key}"]`,
	);
	if (!row) throw new Error(`no row ${key}`);
	return row;
};

describe("variables quick look", () => {
	it("shows the values in use of the active environment and the globals", async () => {
		const user = userEvent.setup();
		renderEnvironments({
			[`GET ${LIST}`]: { body: { items: [summary()] } },
			[`GET ${ACTIVE}`]: ACTIVE_E1,
			[`GET ${ENV_PATH}`]: {
				body: environment({
					variables: [
						variable("baseUrl", "https://staging.test"),
						variable("token", "s3cret", { type: "secret" }),
						variable("legacy", "old", { enabled: false }),
						variable("userId", null),
					],
					localValues: [{ key: "baseUrl", value: "http://localhost:3000" }],
				}),
			},
			[`GET ${GLOBALS}`]: {
				body: {
					workspaceId: "w-team",
					role: "editor",
					variables: [variable("region", "eu")],
					localValues: [],
					updatedAt: null,
				},
			},
		});
		const pane = await openPane(user);
		await waitFor(() => expect(rowOf("baseUrl")).toBeVisible());
		expect(rowOf("baseUrl")).toHaveTextContent("http://localhost:3000");
		expect(rowOf("baseUrl")).toHaveTextContent("local");
		expect(rowOf("token")).toHaveTextContent("••••••••");
		expect(rowOf("token")).not.toHaveTextContent("s3cret");
		await user.click(
			within(rowOf("token")).getByRole("button", {
				name: "Show the value of token",
			}),
		);
		expect(rowOf("token")).toHaveTextContent("s3cret");
		expect(rowOf("legacy")).toHaveTextContent("Off");
		expect(rowOf("userId")).toHaveTextContent("Not shared");
		const globals = within(pane).getByRole("heading", { name: /Globals/ });
		expect(globals).toBeVisible();
		await waitFor(() => expect(rowOf("region")).toHaveTextContent("eu"));
		expect(rowOf("region")).toHaveTextContent("shared");
	});

	it("labels a secret withheld from a Viewer instead of showing a value", async () => {
		renderEnvironments(
			{
				[`GET ${LIST}`]: { body: { items: [summary({ role: "viewer" })] } },
				[`GET ${ACTIVE}`]: ACTIVE_E1,
				[`GET ${ENV_PATH}`]: {
					body: environment({
						role: "viewer",
						variables: [
							variable("token", null, { type: "secret", sharedHidden: true }),
						],
					}),
				},
			},
			{ role: "viewer" },
		);
		await openPane();
		await waitFor(() => expect(rowOf("token")).toHaveTextContent("Hidden"));
		expect(
			within(rowOf("token")).queryByRole("button", { name: /Show the value/ }),
		).toBeNull();
	});

	it("says when no environment is active and the globals are empty", async () => {
		renderEnvironments({ [`GET ${LIST}`]: { body: { items: [] } } });
		const pane = await openPane();
		expect(
			await within(pane).findByText("No environment selected."),
		).toBeVisible();
		expect(await within(pane).findByText("No variables yet.")).toBeVisible();
		expect(
			within(pane).queryByRole("button", { name: /^Edit Staging/ }),
		).toBeNull();
	});

	it("opens the environment from Edit and closes", async () => {
		const user = userEvent.setup();
		renderEnvironments({
			[`GET ${LIST}`]: { body: { items: [summary()] } },
			[`GET ${ACTIVE}`]: ACTIVE_E1,
			[`GET ${ENV_PATH}`]: { body: environment() },
		});
		const pane = await openPane(user);
		await user.click(
			await within(pane).findByRole("button", { name: "Edit Staging" }),
		);
		expect(
			await screen.findByRole("table", { name: "Variables of Staging" }),
		).toBeVisible();
		expect(screen.queryByRole("dialog", { name: "Variables" })).toBeNull();
	});

	it("closes on Escape and gives the focus back", async () => {
		const user = userEvent.setup();
		renderEnvironments({ [`GET ${LIST}`]: { body: { items: [] } } });
		await openPane(user);
		await user.keyboard("{Escape}");
		expect(screen.queryByRole("dialog", { name: "Variables" })).toBeNull();
		expect(
			screen.getByRole("button", { name: "Quick look at variables" }),
		).toHaveFocus();
	});
});
