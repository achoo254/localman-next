import { screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { workspaceStorageKey } from "./current-workspace";
import { WorkspaceSwitcher } from "./workspace-switcher";
import {
	FLAGS_ON,
	PERSONAL,
	TEAM,
	chooseWorkspace,
	renderWithWorkspaces,
} from "./workspaces-test-helpers";

describe("current workspace", () => {
	beforeEach(() => chooseWorkspace(null));
	afterEach(() => vi.unstubAllGlobals());

	it("keeps each account's choice apart on a shared browser", async () => {
		// Another account picked the team workspace in this browser earlier.
		window.localStorage.setItem(workspaceStorageKey("someone-else"), TEAM.id);
		renderWithWorkspaces(
			{},
			{
				path: "/api-client",
				element: <WorkspaceSwitcher />,
				at: "/api-client",
			},
		);
		expect(
			await screen.findByRole("button", {
				name: `Workspace: ${PERSONAL.name}`,
			}),
		).toBeInTheDocument();
	});

	it("shows nothing unless both the workspaces and API client flags are on", () => {
		const { calls } = renderWithWorkspaces(
			{},
			{
				path: "/api-client",
				element: <WorkspaceSwitcher />,
				at: "/api-client",
				flags: { ...FLAGS_ON, apiClient: false },
			},
		);
		expect(screen.queryByRole("button", { name: /^Workspace:/ })).toBeNull();
		expect(calls.some((c) => c.path === "/api/v1/workspaces")).toBe(false);
	});
});
