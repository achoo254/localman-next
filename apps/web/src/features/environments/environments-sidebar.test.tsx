import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { copyText } from "../../platform/clipboard";
import {
	ACTIVE,
	ENV_PATH,
	LIST,
	byId,
	environment,
	renderEnvironments,
	summary,
} from "./environments-test-utils";

vi.mock("../../platform/clipboard", () => ({
	copyText: vi.fn(async () => true),
}));

afterEach(() => {
	vi.unstubAllGlobals();
	vi.mocked(copyText).mockClear();
});

function renderList(role: "admin" | "viewer" = "admin") {
	const envRole = role === "admin" ? "editor" : "viewer";
	return renderEnvironments(
		{
			[`GET ${LIST}`]: { body: { items: [summary({ role: envRole })] } },
			[`GET ${ENV_PATH}`]: { body: environment({ role: envRole }) },
			[`PUT ${ACTIVE}`]: {
				body: { workspaceId: "w-team", environmentId: "e1" },
			},
		},
		{ role },
	);
}

async function openMenu(user: ReturnType<typeof userEvent.setup>) {
	await user.click(await screen.findByRole("button", { name: "Envs" }));
	await user.click(
		await screen.findByRole("button", { name: "More actions for Staging" }),
	);
}

describe("environments sidebar", () => {
	it("sets the environment active from its toggle", async () => {
		const user = userEvent.setup();
		const { calls } = renderList();
		await user.click(await screen.findByRole("button", { name: "Envs" }));
		const toggle = await screen.findByRole("button", {
			name: "Use Staging as the active environment",
		});
		expect(toggle).toHaveAttribute("aria-pressed", "false");
		await user.click(toggle);
		await waitFor(() => expect(toggle).toHaveAttribute("aria-pressed", "true"));
		expect(
			calls.find((c) => c.method === "PUT" && c.path === ACTIVE)?.body,
		).toEqual({ environmentId: "e1" });
	});

	it("copies the environment's link", async () => {
		const user = userEvent.setup();
		renderList();
		await openMenu(user);
		await user.click(
			await screen.findByRole("menuitem", { name: "Copy link" }),
		);
		expect(copyText).toHaveBeenCalledWith(
			`${window.location.origin}/elements/environment/e1`,
		);
		expect(await screen.findByText("Copied the link.")).toBeVisible();
	});

	it("opens the page with the name ready to edit from Rename", async () => {
		const user = userEvent.setup();
		renderList();
		await openMenu(user);
		await user.click(await screen.findByRole("menuitem", { name: "Rename" }));
		await screen.findByRole("table", { name: "Variables of Staging" });
		await waitFor(() =>
			expect(
				screen.getByRole("textbox", { name: "Environment name" }),
			).toHaveFocus(),
		);
	});

	it("opens Share from the menu", async () => {
		const user = userEvent.setup();
		renderList();
		await openMenu(user);
		await user.click(await screen.findByRole("menuitem", { name: "Share" }));
		expect(await screen.findByRole("dialog")).toBeVisible();
	});

	it("tells a Viewer why create and import are off, and hides Rename", async () => {
		const user = userEvent.setup();
		renderList("viewer");
		await openMenu(user);
		expect(
			await screen.findByRole("menuitem", { name: "Copy link" }),
		).toBeVisible();
		expect(screen.queryByRole("menuitem", { name: "Rename" })).toBeNull();
		await user.keyboard("{Escape}");
		const reason = "Viewers can't add environments to this workspace.";
		expect(byId("sidebar-envs-readonly")).toHaveTextContent(reason);
		expect(
			screen.getByRole("button", { name: "New environment" }),
		).toHaveAccessibleDescription(reason);
		expect(
			screen.getByRole("button", { name: "Import environment" }),
		).toHaveAccessibleDescription(reason);
	});
});
