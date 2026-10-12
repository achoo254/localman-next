import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	ACTIVE,
	LIST,
	byId,
	environment,
	renderEnvironments,
} from "./environments-test-utils";

afterEach(() => vi.unstubAllGlobals());

describe("environment selector", () => {
	it("creates an environment, opens it and makes it active", async () => {
		const user = userEvent.setup();
		const created = environment({
			id: "e2",
			name: "New environment",
			variables: [],
		});
		const { calls } = renderEnvironments({
			[`GET ${LIST}`]: { body: { items: [] } },
			[`POST ${LIST}`]: { status: 201, body: created },
			[`PUT ${ACTIVE}`]: {
				body: { workspaceId: "w-team", environmentId: "e2" },
			},
		});
		await user.click(
			await screen.findByRole("button", {
				name: "Active environment: No environment",
			}),
		);
		await user.click(
			await screen.findByRole("menuitem", { name: "Create environment" }),
		);
		expect(
			await screen.findByRole("table", {
				name: "Variables of New environment",
			}),
		).toBeVisible();
		await waitFor(() =>
			expect(
				calls.find((c) => c.method === "PUT" && c.path === ACTIVE)?.body,
			).toEqual({
				environmentId: "e2",
			}),
		);
	});

	it("keeps Create environment off for a Viewer of the workspace", async () => {
		const user = userEvent.setup();
		renderEnvironments(
			{ [`GET ${LIST}`]: { body: { items: [] } } },
			{ role: "viewer" },
		);
		await user.click(
			await screen.findByRole("button", {
				name: "Active environment: No environment",
			}),
		);
		const create = await screen.findByRole("menuitem", {
			name: "Create environment",
		});
		expect(create).toHaveAttribute("aria-disabled", "true");
		expect(create).toHaveAccessibleDescription(
			"Viewers can't add environments to this workspace.",
		);
		expect(byId("env-select-readonly")).toBeVisible();
		expect(byId("tabbar-env-create")).toBeNull();
	});

	it("creates and activates from the + next to the selector", async () => {
		const user = userEvent.setup();
		const created = environment({ id: "e2", name: "New environment" });
		const { calls } = renderEnvironments({
			[`GET ${LIST}`]: { body: { items: [] } },
			[`POST ${LIST}`]: { status: 201, body: created },
			[`PUT ${ACTIVE}`]: {
				body: { workspaceId: "w-team", environmentId: "e2" },
			},
		});
		await user.click(
			await screen.findByRole("button", { name: "Create environment" }),
		);
		expect(
			await screen.findByRole("table", {
				name: "Variables of New environment",
			}),
		).toBeVisible();
		await waitFor(() =>
			expect(calls.some((c) => c.method === "PUT" && c.path === ACTIVE)).toBe(
				true,
			),
		);
	});

	it("shows the Environments sidebar from Manage environments", async () => {
		const user = userEvent.setup();
		renderEnvironments({ [`GET ${LIST}`]: { body: { items: [] } } });
		await user.click(
			await screen.findByRole("button", {
				name: "Active environment: No environment",
			}),
		);
		expect(byId("sidebar-envs")).toBeNull();
		await user.click(
			await screen.findByRole("menuitem", { name: "Manage environments" }),
		);
		await waitFor(() => expect(byId("sidebar-envs")).toBeVisible());
	});
});
