import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FetchCall } from "../../test/mock-fetch";
import {
	ENV_PATH,
	LIST,
	byId,
	environment,
	openStaging,
	renderEnvironments,
	summary,
	variable,
} from "./environments-test-utils";

afterEach(() => vi.unstubAllGlobals());

const SAVE = { timeout: 3000 };

// baseUrl: shared, your local differs · newVar: not shared, local only
// token: shared secret, no local value
const staging = (role: "editor" | "viewer" = "editor") =>
	environment({
		role,
		variables: [
			variable("baseUrl", "https://staging.test"),
			variable("token", role === "editor" ? "s3cret" : null, {
				type: "secret",
				sharedHidden: role === "viewer",
			}),
			variable("newVar", null),
		],
		localValues: [
			{ key: "baseUrl", value: "http://localhost:3000" },
			{ key: "newVar", value: "abc" },
		],
	});

function renderStaging(role: "editor" | "viewer" = "editor") {
	return renderEnvironments(
		{
			[`GET ${LIST}`]: { body: { items: [summary({ role })] } },
			[`GET ${ENV_PATH}`]: { body: staging(role) },
			[`PUT ${ENV_PATH}/variables`]: { body: staging(role) },
			[`PATCH ${ENV_PATH}/local-values`]: { body: { localValues: [] } },
		},
		{ role: role === "editor" ? "admin" : "viewer" },
	);
}

const sent = (calls: FetchCall[], method: string, path: string) =>
	calls.filter((call) => call.method === method && call.path === path);

const headerMore = (): HTMLElement => {
	const more = byId("environment-header-more");
	if (!more) throw new Error("no More button in the environment header");
	return more;
};

async function chooseAll(
	user: ReturnType<typeof userEvent.setup>,
	name: string,
) {
	await user.click(headerMore());
	await user.click(await screen.findByRole("menuitem", { name }));
}

describe("environment “all” actions", () => {
	it("Share all shares every unshared local value in one save", async () => {
		const user = userEvent.setup();
		const { calls } = renderStaging();
		await openStaging(user);
		await chooseAll(user, "Share all");
		const puts = () => sent(calls, "PUT", `${ENV_PATH}/variables`);
		await waitFor(() => expect(puts()).toHaveLength(1), SAVE);
		expect(puts()[0]?.body).toMatchObject({
			variables: [
				{ key: "baseUrl", sharedValue: "https://staging.test" },
				{ key: "token", sharedValue: "s3cret" },
				{ key: "newVar", sharedValue: "abc" },
			],
		});
		await waitFor(
			() =>
				expect(
					sent(calls, "PATCH", `${ENV_PATH}/local-values`)[0]?.body,
				).toEqual({ values: [{ key: "newVar", value: null }] }),
			SAVE,
		);
	});

	it("Update all shared values pushes every edited local value", async () => {
		const user = userEvent.setup();
		const { calls } = renderStaging();
		await openStaging(user);
		await chooseAll(user, "Update all shared values");
		const puts = () => sent(calls, "PUT", `${ENV_PATH}/variables`);
		await waitFor(() => expect(puts()).toHaveLength(1), SAVE);
		expect(puts()[0]?.body).toMatchObject({
			variables: [
				{ key: "baseUrl", sharedValue: "http://localhost:3000" },
				{ key: "token", sharedValue: "s3cret" },
				{ key: "newVar", sharedValue: null },
			],
		});
		await waitFor(
			() =>
				expect(
					sent(calls, "PATCH", `${ENV_PATH}/local-values`)[0]?.body,
				).toEqual({ values: [{ key: "baseUrl", value: null }] }),
			SAVE,
		);
	});

	it("Reset all asks, then resets every local value in one request", async () => {
		const user = userEvent.setup();
		const { calls } = renderStaging();
		await openStaging(user);
		await chooseAll(user, "Reset all");
		const dialog = await screen.findByRole("dialog", { name: "Reset all" });
		expect(dialog).toHaveTextContent("Your local values of 2 variables");
		await user.click(within(dialog).getByRole("button", { name: "Reset all" }));
		await waitFor(() =>
			expect(screen.queryByRole("dialog", { name: "Reset all" })).toBeNull(),
		);
		const patches = sent(calls, "PATCH", `${ENV_PATH}/local-values`);
		expect(patches).toHaveLength(1);
		expect(patches[0]?.body).toEqual({
			values: [
				{ key: "baseUrl", value: null },
				{ key: "newVar", value: null },
			],
		});
		expect(sent(calls, "PUT", `${ENV_PATH}/variables`)).toHaveLength(0);
	});

	it("Unshare all asks, then drops every shared value in one request", async () => {
		const user = userEvent.setup();
		const { calls } = renderStaging();
		await openStaging(user);
		await chooseAll(user, "Unshare all");
		const dialog = await screen.findByRole("dialog", { name: "Unshare all" });
		expect(dialog).toHaveTextContent("2 shared values are removed");
		await user.click(
			within(dialog).getByRole("button", { name: "Unshare all" }),
		);
		await waitFor(() =>
			expect(screen.queryByRole("dialog", { name: "Unshare all" })).toBeNull(),
		);
		const puts = sent(calls, "PUT", `${ENV_PATH}/variables`);
		expect(puts).toHaveLength(1);
		expect(puts[0]?.body).toMatchObject({
			variables: [
				{ key: "baseUrl", sharedValue: null },
				{ key: "token", sharedValue: null },
				{ key: "newVar", sharedValue: null },
			],
		});
		expect(sent(calls, "PATCH", `${ENV_PATH}/local-values`)).toHaveLength(0);
	});

	it("gives a Viewer Reset all only, saying why the others are off", async () => {
		const user = userEvent.setup();
		renderStaging("viewer");
		await openStaging(user);
		await user.click(headerMore());
		for (const name of [
			"Share all",
			"Update all shared values",
			"Unshare all",
		]) {
			expect(await screen.findByRole("menuitem", { name })).toHaveAttribute(
				"aria-disabled",
				"true",
			);
		}
		expect(
			screen.getByRole("menuitem", { name: "Reset all" }),
		).not.toHaveAttribute("aria-disabled");
		expect(byId("vars-more-editors-only")).toHaveTextContent(
			"Only Editors can change shared values.",
		);
	});
});
