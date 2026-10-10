import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NO_FEATURES } from "../../config/features";
import { findToast } from "../../test/toast";
import {
	LIST,
	PERSONAL,
	TEAM,
	TEAM_PATH,
	byId,
	chooseWorkspace,
	renderSettings,
	savedWorkspace,
} from "./workspaces-test-helpers";

describe("workspace settings · general", () => {
	beforeEach(() => chooseWorkspace(TEAM.id));
	afterEach(() => vi.unstubAllGlobals());

	it("redirects to the API client while the flag is off", async () => {
		renderSettings({}, { flags: { ...NO_FEATURES, workspaces: false } });
		expect(await screen.findByText("Workbench page")).toBeInTheDocument();
	});

	it("shows the current workspace with the section nav and a way back", async () => {
		renderSettings({});
		expect(
			await screen.findByRole("heading", {
				level: 1,
				name: "Workspace settings",
			}),
		).toBeInTheDocument();
		expect(byId("ws-settings-page")).toHaveTextContent("Team Payments");
		expect(byId("ws-settings-tab-general")).toHaveAttribute(
			"aria-selected",
			"true",
		);
		expect(byId("ws-settings-tab-members")).toHaveTextContent("Members");
		expect(screen.getByRole("link", { name: "Workbench" })).toHaveAttribute(
			"href",
			"/api-client",
		);
	});

	it("saves the name and description for Admins", async () => {
		const { calls } = renderSettings({
			[`PATCH ${TEAM_PATH}`]: {
				body: { ...TEAM, name: "Payments", description: null },
			},
		});
		const name = await screen.findByLabelText(/Workspace name/);
		const save = screen.getByRole("button", { name: "Save" });
		expect(save).toBeDisabled();
		await userEvent.clear(name);
		await userEvent.click(save);
		expect(
			await screen.findByText("Enter a workspace name."),
		).toBeInTheDocument();
		await userEvent.type(name, "Payments");
		await userEvent.clear(screen.getByLabelText(/Description/));
		await userEvent.click(save);
		expect(await findToast("Saved the workspace details")).toBeVisible();
		expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({
			name: "Payments",
			description: null,
		});
	});

	it("is read-only for members who are not Admins", async () => {
		renderSettings({
			[LIST]: { body: { items: [PERSONAL, { ...TEAM, role: "editor" }] } },
		});
		expect(await screen.findByLabelText(/Workspace name/)).toBeDisabled();
		expect(
			screen.getByText("Only Admins can edit the workspace details."),
		).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
		expect(byId("ws-settings-delete")).toBeNull();
	});

	it("has no delete for a personal workspace", async () => {
		chooseWorkspace(PERSONAL.id);
		renderSettings({});
		await screen.findByLabelText(/Workspace name/);
		expect(byId("ws-settings-delete")).toBeNull();
		expect(byId("ws-settings-general")).toHaveTextContent(
			"Personal · only you can see it",
		);
	});

	it("deletes a team workspace after confirmation", async () => {
		const items = [PERSONAL, TEAM];
		const { calls } = renderSettings({
			[LIST]: () => ({ body: { items } }),
			[`DELETE ${TEAM_PATH}`]: () => {
				items.pop();
				return {
					body: { dryRun: false, deleted: true, workspace: TEAM, members: 2 },
				};
			},
		});
		await userEvent.click(
			await screen.findByRole("button", { name: "Delete workspace" }),
		);
		const dialog = await screen.findByRole("dialog", {
			name: "Delete workspace",
		});
		expect(dialog).toHaveTextContent("Delete “Team Payments”?");
		// Destructive dialogs open on the safe choice.
		expect(
			within(dialog).getByRole("button", { name: "Cancel" }),
		).toHaveFocus();
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Delete workspace" }),
		);
		expect(await findToast("Deleted workspace Team Payments")).toBeVisible();
		expect(await screen.findByText("Workbench page")).toBeInTheDocument();
		expect(calls.some((c) => c.method === "DELETE")).toBe(true);
		await waitFor(() => expect(savedWorkspace()).toBe(PERSONAL.id));
	});
});
