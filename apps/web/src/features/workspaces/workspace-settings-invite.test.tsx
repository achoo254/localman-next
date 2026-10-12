import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { findToast } from "../../test/toast";
import {
	ME,
	MEMBERS,
	PERSONAL,
	TEAM,
	TEAM_PATH,
	allById,
	apiError,
	byId,
	chooseWorkspace,
	findMembersPane,
	invitation,
	memberStore,
	membersBody,
	renderSettings,
	teamMember,
} from "./workspaces-test-helpers";

const LAN = teamMember("lan");

describe("workspace settings · inviting", () => {
	beforeEach(() => chooseWorkspace(TEAM.id));
	afterEach(() => vi.unstubAllGlobals());

	it("invites by username with a role and refreshes the list", async () => {
		const store = memberStore([ME]);
		const { calls } = renderSettings(
			{
				[`GET ${MEMBERS}`]: () => store.get(),
				[`POST ${TEAM_PATH}/invitations`]: () => {
					store.rows.push(LAN);
					return {
						status: 201,
						body: {
							invitation: invitation("i9", { username: "lan" }),
							inviteLink: "/workspace-invite/tokABC",
							notified: true,
						},
					};
				},
			},
			{ tab: "members" },
		);
		await findMembersPane();
		await userEvent.click(screen.getByRole("button", { name: "Invite" }));
		expect(
			await screen.findByText("Enter a username or email."),
		).toBeInTheDocument();
		await userEvent.type(screen.getByLabelText("Username or email"), "lan");
		await userEvent.selectOptions(
			screen.getByRole("combobox", { name: "Role" }),
			"viewer",
		);
		await userEvent.click(screen.getByRole("button", { name: "Invite" }));
		expect(await findToast("Invited @lan")).toHaveTextContent(
			"They'll get a notification.",
		);
		expect(calls.find((c) => c.method === "POST")?.body).toEqual({
			usernameOrEmail: "lan",
			role: "viewer",
		});
		await waitFor(() => expect(allById("ws-settings-member")).toHaveLength(2));
		expect(byId("ws-settings-invite-url")).toHaveValue(
			`${window.location.origin}/workspace-invite/tokABC`,
		);
	});

	it("shows the error of a refused invitation in the form", async () => {
		renderSettings(
			{
				[`GET ${MEMBERS}`]: membersBody([ME]),
				[`POST ${TEAM_PATH}/invitations`]: apiError(404, "INVITEE_NOT_FOUND"),
			},
			{ tab: "members" },
		);
		await findMembersPane();
		await userEvent.type(screen.getByLabelText("Username or email"), "ghost");
		await userEvent.click(screen.getByRole("button", { name: "Invite" }));
		expect(
			await screen.findByText(
				"No account uses this username. Check it, or invite them by email.",
			),
		).toBeInTheDocument();
	});

	it("creates a one-use invite link with the chosen role", async () => {
		const { calls } = renderSettings(
			{
				[`GET ${MEMBERS}`]: membersBody([ME]),
				[`POST ${TEAM_PATH}/invite-links`]: {
					status: 201,
					body: {
						invitation: invitation("i3", { kind: "link", username: null }),
						inviteLink: "/workspace-invite/tokLINK",
						notified: false,
					},
				},
			},
			{ tab: "members" },
		);
		await findMembersPane();
		await userEvent.click(
			screen.getByRole("button", {
				name: "Copy invite link (one use, 7 days)",
			}),
		);
		expect(await findToast("Created a one-use invite link")).toBeVisible();
		expect(calls.find((c) => c.method === "POST")?.body).toEqual({
			role: "editor",
		});
		expect(screen.getByLabelText("One-use invite link")).toHaveValue(
			`${window.location.origin}/workspace-invite/tokLINK`,
		);
	});

	it("locks inviting when every seat is taken, without plans", async () => {
		renderSettings(
			{
				[`GET ${MEMBERS}`]: membersBody([ME, LAN], [invitation("i1")], 3),
			},
			{ tab: "members" },
		);
		await findMembersPane();
		expect(byId("ws-settings-member-count")).toHaveTextContent(
			"3/3 members (pending invitations included)",
		);
		const card = byId("ws-settings-members-full") as HTMLElement;
		expect(card).toHaveTextContent(
			"Every seat is taken. Remove a member or cancel an invitation to invite someone else.",
		);
		expect(card).not.toHaveTextContent(/plan|Pro/);
		expect(within(card).queryByRole("link")).toBeNull();
		expect(screen.getByLabelText("Username or email")).toBeDisabled();
		expect(screen.getByRole("button", { name: "Invite" })).toBeDisabled();
	});

	it("refreshes the seats when an invitation hits the plan limit", async () => {
		let full = false;
		renderSettings(
			{
				[`GET ${MEMBERS}`]: () =>
					membersBody([ME, LAN], full ? [invitation("i1")] : [], 3),
				[`POST ${TEAM_PATH}/invitations`]: () => {
					full = true;
					return apiError(403, "PLAN_LIMIT_REACHED", { limit: "members" });
				},
			},
			{ tab: "members" },
		);
		await findMembersPane();
		await userEvent.type(screen.getByLabelText("Username or email"), "hoa");
		await userEvent.click(screen.getByRole("button", { name: "Invite" }));
		expect(
			await screen.findByText(
				"There's no free seat in this workspace. Remove a member or cancel an invitation first.",
			),
		).toBeInTheDocument();
		await waitFor(() =>
			expect(byId("ws-settings-members-full")).toHaveTextContent(
				"Every seat is taken.",
			),
		);
	});

	it("asks a personal workspace to create a team workspace instead", async () => {
		chooseWorkspace(PERSONAL.id);
		renderSettings({}, { tab: "members" });
		const pane = await findMembersPane();
		expect(pane).toHaveTextContent(
			"A personal workspace has no members.Create a team workspace to collaborate.",
		);
		await userEvent.click(byId("ws-settings-create-team") as HTMLElement);
		expect(
			await screen.findByRole("dialog", { name: "Create workspace" }),
		).toBeInTheDocument();
	});
});
