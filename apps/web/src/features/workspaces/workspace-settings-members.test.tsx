import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { findToast } from "../../test/toast";
import {
	LIST,
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
	savedWorkspace,
	teamMember,
} from "./workspaces-test-helpers";

const LAN = teamMember("lan");

describe("workspace settings · members", () => {
	beforeEach(() => chooseWorkspace(TEAM.id));
	afterEach(() => vi.unstubAllGlobals());

	it("shows seats, members, pending invitations and the role table", async () => {
		renderSettings(
			{
				[`GET ${MEMBERS}`]: membersBody(
					[ME, LAN],
					[
						invitation("i1", { emailVerified: false }),
						invitation("i2", { kind: "link", username: null }),
					],
					10,
				),
			},
			{ tab: "members" },
		);
		const pane = await findMembersPane();
		expect(byId("ws-settings-member-count")).toHaveTextContent(
			"4/10 members (pending invitations included)",
		);
		const rows = allById("ws-settings-member");
		expect(rows).toHaveLength(2);
		expect(rows[0]).toHaveTextContent("Minh Anh (you)");
		// Nobody changes or removes their own role here: they leave instead.
		expect(within(rows[0] as HTMLElement).getByRole("combobox")).toBeDisabled();
		expect(
			within(pane).queryByRole("button", { name: "Remove Minh Anh" }),
		).toBeNull();
		expect(
			within(pane).getByRole("combobox", { name: "Role of Lan" }),
		).toHaveValue("editor");
		const invites = allById("ws-settings-invite-item");
		expect(invites[0]).toHaveTextContent("@hoa");
		expect(invites[0]).toHaveTextContent("email not verified");
		expect(invites[1]).toHaveTextContent("Invite link");
		expect(invites[1]).toHaveTextContent("Expires Oct 17, 2026");
		// Read from the shared permission table: only Admins delete workspaces.
		const table = within(pane).getByRole("table", { hidden: true });
		expect(
			within(table).getByRole("row", {
				hidden: true,
				name: "Create and delete workspaces Allowed Not allowed Not allowed",
			}),
		).toBeInTheDocument();
		expect(byId("ws-settings-leave")).toHaveTextContent("Leave workspace");
	});

	it("changes a role, and puts it back when the API refuses", async () => {
		let refuse = false;
		renderSettings(
			{
				[`GET ${MEMBERS}`]: membersBody([ME, LAN]),
				[`PATCH ${MEMBERS}/m-lan`]: () =>
					refuse
						? apiError(409, "LAST_ADMIN")
						: { body: { member: { ...LAN, role: "viewer" } } },
			},
			{ tab: "members" },
		);
		await findMembersPane();
		const select = screen.getByRole("combobox", { name: "Role of Lan" });
		await userEvent.selectOptions(select, "viewer");
		expect(await findToast("Lan is now Viewer")).toBeVisible();
		expect(select).toHaveValue("viewer");

		refuse = true;
		await userEvent.selectOptions(select, "admin");
		expect(
			await findToast(
				"A team workspace needs at least one Admin. Make another member Admin first.",
			),
		).toBeVisible();
		await waitFor(() => expect(select).toHaveValue("viewer"));
	});

	it("removes a member after confirmation", async () => {
		const store = memberStore([ME, LAN]);
		renderSettings(
			{
				[`GET ${MEMBERS}`]: () => store.get(),
				[`DELETE ${MEMBERS}/m-lan`]: () => {
					store.rows.splice(1, 1);
					return { body: { dryRun: false, removed: true, member: LAN } };
				},
			},
			{ tab: "members" },
		);
		await findMembersPane();
		await userEvent.click(screen.getByRole("button", { name: "Remove Lan" }));
		const dialog = await screen.findByRole("dialog", { name: "Remove member" });
		expect(dialog).toHaveTextContent("Remove Lan from Team Payments?");
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Remove member" }),
		);
		expect(await findToast("Removed Lan")).toBeVisible();
		await waitFor(() => expect(allById("ws-settings-member")).toHaveLength(1));
	});

	it("keeps the last Admin from leaving, with the reason in the dialog", async () => {
		renderSettings(
			{
				[`GET ${MEMBERS}`]: membersBody([ME, LAN]),
				[`POST ${TEAM_PATH}/leave`]: apiError(409, "LAST_ADMIN"),
			},
			{ tab: "members" },
		);
		await findMembersPane();
		await userEvent.click(
			screen.getByRole("button", { name: "Leave workspace" }),
		);
		const dialog = await screen.findByRole("dialog", {
			name: "Leave workspace",
		});
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Leave workspace" }),
		);
		expect(
			await within(dialog).findByText(
				"A team workspace needs at least one Admin. Make another member Admin first.",
			),
		).toBeInTheDocument();
	});

	it("leaves a workspace and goes back to the personal one", async () => {
		const items = [PERSONAL, TEAM];
		renderSettings(
			{
				[LIST]: () => ({ body: { items } }),
				[`GET ${MEMBERS}`]: membersBody([ME, LAN]),
				[`POST ${TEAM_PATH}/leave`]: () => {
					items.pop();
					return { body: { dryRun: false, left: true, member: ME } };
				},
			},
			{ tab: "members" },
		);
		await findMembersPane();
		await userEvent.click(
			screen.getByRole("button", { name: "Leave workspace" }),
		);
		const dialog = await screen.findByRole("dialog");
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Leave workspace" }),
		);
		expect(await findToast("You left Team Payments")).toBeVisible();
		expect(await screen.findByText("Workbench page")).toBeInTheDocument();
		expect(savedWorkspace()).toBe(PERSONAL.id);
	});

	it("shows a read-only list to members who are not Admins", async () => {
		chooseWorkspace(TEAM.id);
		renderSettings(
			{
				[LIST]: { body: { items: [PERSONAL, { ...TEAM, role: "viewer" }] } },
				[`GET ${MEMBERS}`]: membersBody([
					{ ...ME, role: "viewer" },
					{ ...LAN, role: "admin" },
				]),
			},
			{ tab: "members" },
		);
		const pane = await findMembersPane();
		expect(byId("ws-settings-invite-form")).toBeNull();
		expect(
			within(pane).getByRole("combobox", { name: "Role of Lan" }),
		).toBeDisabled();
		expect(
			within(pane).queryByRole("button", { name: "Remove Lan" }),
		).toBeNull();
		expect(byId("ws-settings-members-full")).toBeNull();
	});
});
