import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	ACTIVE,
	ENV_PATH,
	LIST,
	byId,
	environment,
	renderEnvironments,
	variable,
} from "./environments-test-utils";

afterEach(() => vi.unstubAllGlobals());

const summary = (overrides = {}) => {
	const { variables, localValues, createdBy, createdAt, ...rest } =
		environment(overrides);
	return rest;
};

async function openEnvironment(user = userEvent.setup()) {
	await user.click(await screen.findByRole("button", { name: "Envs" }));
	await user.click(await screen.findByRole("button", { name: "Staging" }));
	return screen.findByRole("table", { name: "Variables of Staging" });
}

describe("environment page", () => {
	it("lets an Editor set a local value and change a shared value", async () => {
		const user = userEvent.setup();
		const { calls } = renderEnvironments({
			[`GET ${LIST}`]: { body: { items: [summary()] } },
			[`GET ${ENV_PATH}`]: { body: environment() },
			[`PATCH ${ENV_PATH}/local-values`]: {
				body: {
					localValues: [{ key: "baseUrl", value: "http://localhost:3000" }],
				},
			},
			[`PUT ${ENV_PATH}/variables`]: { body: environment() },
		});
		const table = await openEnvironment(user);
		const local = within(table).getByRole("textbox", {
			name: "Local value of baseUrl",
		});
		await user.type(local, "http://localhost:3000");
		await waitFor(() =>
			expect(calls.some((c) => c.path === `${ENV_PATH}/local-values`)).toBe(
				true,
			),
		);
		const patch = calls
			.filter((c) => c.path === `${ENV_PATH}/local-values`)
			.at(-1);
		expect(patch?.body).toEqual({
			values: [{ key: "baseUrl", value: "http://localhost:3000" }],
		});
		const shared = within(table).getByRole("textbox", {
			name: "Shared value of baseUrl",
		});
		await user.clear(shared);
		await user.type(shared, "https://qa.test");
		await waitFor(() =>
			expect(
				calls.some(
					(c) => c.method === "PUT" && c.path === `${ENV_PATH}/variables`,
				),
			).toBe(true),
		);
		const put = calls.filter((c) => c.path === `${ENV_PATH}/variables`).at(-1);
		expect(put?.body).toMatchObject({
			variables: [
				{ id: "v-baseUrl", key: "baseUrl", sharedValue: "https://qa.test" },
				{ id: "v-token", key: "token", type: "secret" },
			],
		});
	});

	it("shows a Viewer the read-only state, a hidden secret and Request to edit", async () => {
		const viewer = environment({
			role: "viewer",
			variables: [
				variable("baseUrl", "https://staging.test"),
				variable("token", null, { type: "secret", sharedHidden: true }),
			],
		});
		renderEnvironments(
			{
				[`GET ${LIST}`]: { body: { items: [summary({ role: "viewer" })] } },
				[`GET ${ENV_PATH}`]: { body: viewer },
			},
			{ role: "viewer" },
		);
		const table = await openEnvironment();
		expect(byId("environment-header-readonly")).toHaveTextContent("Read only");
		expect(
			screen.getByRole("button", { name: "Request to edit" }),
		).toBeVisible();
		expect(byId("environment-viewer-note")).toBeVisible();
		expect(within(table).getByText("Hidden")).toBeVisible();
		expect(
			within(table).getByRole("textbox", { name: "Shared value of baseUrl" }),
		).toHaveAttribute("readonly");
		expect(
			within(table).getByRole("textbox", { name: "Local value of baseUrl" }),
		).toBeEnabled();
		expect(screen.queryByRole("button", { name: "Add variable" })).toBeNull();
	});

	it("picks the active environment from the selector", async () => {
		const user = userEvent.setup();
		const { calls } = renderEnvironments({
			[`GET ${LIST}`]: { body: { items: [summary()] } },
			[`PUT ${ACTIVE}`]: {
				body: { workspaceId: "w-team", environmentId: "e1" },
			},
		});
		await user.click(
			await screen.findByRole("button", {
				name: "Active environment: No environment",
			}),
		);
		await user.click(
			await screen.findByRole("menuitemradio", { name: "Staging" }),
		);
		await waitFor(() =>
			expect(calls.some((c) => c.method === "PUT" && c.path === ACTIVE)).toBe(
				true,
			),
		);
		expect(
			calls.find((c) => c.path === ACTIVE && c.method === "PUT")?.body,
		).toEqual({
			environmentId: "e1",
		});
		expect(
			await screen.findByRole("button", {
				name: "Active environment: Staging",
			}),
		).toBeVisible();
	});

	it("creates an environment from the sidebar and opens it", async () => {
		const user = userEvent.setup();
		const created = environment({ name: "New environment", variables: [] });
		const { calls } = renderEnvironments({
			[`GET ${LIST}`]: { body: { items: [] } },
			[`POST ${LIST}`]: { status: 201, body: created },
			[`GET ${ENV_PATH}`]: { body: created },
		});
		await user.click(await screen.findByRole("button", { name: "Envs" }));
		expect(await screen.findByText(/No environments yet/)).toBeVisible();
		await user.click(screen.getByRole("button", { name: "New environment" }));
		await waitFor(() =>
			expect(calls.some((c) => c.method === "POST" && c.path === LIST)).toBe(
				true,
			),
		);
		expect(
			await screen.findByRole("table", {
				name: "Variables of New environment",
			}),
		).toBeVisible();
	});
});
