import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WORKSPACES_KEY } from "./current-workspace";
import { WorkspaceInvitePage } from "./workspace-invite-page";
import { WorkspaceSwitcher } from "./workspace-switcher";
import {
	LIST,
	PERSONAL,
	TEAM,
	chooseWorkspace,
	renderWithWorkspaces,
	savedWorkspace,
} from "./workspaces-test-helpers";

const TOKEN = "wtok_ABCDEFGHIJKLMNOPQRSTUVWXYZ012345";

describe("joining a workspace from an invite", () => {
	beforeEach(() => chooseWorkspace(null));
	afterEach(() => vi.unstubAllGlobals());

	it("opens the workbench on the joined workspace, not the cached list's fallback", async () => {
		let joined = false;
		const { queryClient } = renderWithWorkspaces(
			{
				[LIST]: () => ({
					body: { items: joined ? [PERSONAL, TEAM] : [PERSONAL] },
				}),
				"POST /api/v1/workspace-invites/preview": {
					body: {
						workspace: { id: TEAM.id, name: TEAM.name },
						kind: "link",
						role: "editor",
						inviter: { username: "hoa", name: null, picture: null },
						expiresAt: null,
						inviteeEmail: null,
						eligible: true,
						reason: null,
					},
				},
				"POST /api/v1/workspace-invites/accept": () => {
					joined = true;
					return { body: { workspaceId: TEAM.id, alreadyMember: false } };
				},
			},
			{
				path: "/workspace-invite/:token",
				element: <WorkspaceInvitePage />,
				at: `/workspace-invite/${TOKEN}`,
				workbench: <WorkspaceSwitcher />,
			},
		);
		// The list was loaded earlier in the session, before joining.
		queryClient.setQueryData(WORKSPACES_KEY, [PERSONAL]);
		await userEvent.click(
			await screen.findByRole("button", { name: "Join workspace" }),
		);
		expect(
			await screen.findByRole("button", { name: `Workspace: ${TEAM.name}` }),
		).toBeInTheDocument();
		expect(savedWorkspace()).toBe(TEAM.id);
	});
});
