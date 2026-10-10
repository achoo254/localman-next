import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NO_FEATURES } from "../../config/features";
import { type MockRoute, UNAUTHENTICATED } from "../../test/mock-fetch";
import { findToast } from "../../test/toast";
import { resetCurrentUserCache } from "../auth/use-current-user";
import { WorkspaceInvitePage } from "./workspace-invite-page";
import type { WorkspaceInvitePreview } from "./workspace-invites-api";
import {
	FLAGS_ON,
	apiError,
	byId,
	chooseWorkspace,
	renderWithWorkspaces,
	savedWorkspace,
} from "./workspaces-test-helpers";

const TOKEN = "wtok_ABCDEFGHIJKLMNOPQRSTUVWXYZ012345";
const PREVIEW = "POST /api/v1/workspace-invites/preview";
const ACCEPT = "POST /api/v1/workspace-invites/accept";

function preview(overrides: Partial<WorkspaceInvitePreview> = {}) {
	const body: WorkspaceInvitePreview = {
		workspace: { id: "w-team", name: "Team Payments" },
		kind: "account",
		role: "editor",
		inviter: { username: "hoa", name: "Hoà", picture: null },
		expiresAt: "2026-10-17T01:00:00.000Z",
		inviteeEmail: "m***@example.com",
		eligible: true,
		reason: null,
		...overrides,
	};
	return { body };
}

function renderInvite(routes: Record<string, MockRoute>, flags = FLAGS_ON) {
	return renderWithWorkspaces(routes, {
		path: "/workspace-invite/:token",
		element: <WorkspaceInvitePage />,
		at: `/workspace-invite/${TOKEN}`,
		flags,
	});
}

describe("/workspace-invite/:token", () => {
	beforeEach(() => {
		resetCurrentUserCache();
		chooseWorkspace(null);
	});
	afterEach(() => vi.unstubAllGlobals());

	it("redirects to the API client while the flag is off", async () => {
		const { calls } = renderInvite({}, { ...NO_FEATURES, workspaces: false });
		expect(await screen.findByText("Workbench page")).toBeInTheDocument();
		expect(calls.some((c) => c.path.includes("workspace-invites"))).toBe(false);
	});

	it("asks anonymous visitors to sign in before showing anything", async () => {
		const { calls } = renderInvite({ "GET /api/v1/users/me": UNAUTHENTICATED });
		expect(
			await screen.findByRole("heading", {
				name: "You're invited to join a workspace on Localman",
			}),
		).toHaveFocus();
		expect(byId("ws-invite-page-login")).toHaveTextContent("Sign in");
		expect(calls.some((c) => c.path.includes("workspace-invites"))).toBe(false);
	});

	it("previews, accepts, makes the workspace current and opens the workbench", async () => {
		const { calls } = renderInvite({
			[PREVIEW]: preview(),
			[ACCEPT]: { body: { workspaceId: "w-team", alreadyMember: false } },
		});
		expect(
			await screen.findByRole("heading", { name: "Join Team Payments" }),
		).toBeInTheDocument();
		expect(byId("ws-invite-page-inviter")).toHaveTextContent(
			"Hoà (@hoa) invited you as Editor.",
		);
		expect(byId("ws-invite-page-expiry")).toHaveTextContent(
			"Expires Oct 17, 2026",
		);
		await userEvent.click(
			screen.getByRole("button", { name: "Join workspace" }),
		);
		expect(await findToast("Joined Team Payments")).toBeVisible();
		expect(await screen.findByText("Workbench page")).toBeInTheDocument();
		expect(savedWorkspace()).toBe("w-team");
		// The token only ever travels in a request body.
		expect(calls.find((c) => c.path.endsWith("/accept"))?.body).toEqual({
			token: TOKEN,
		});
		expect(calls.every((c) => !c.path.includes(TOKEN))).toBe(true);
	});

	it.each([
		["NOT_INVITEE", "The invitation was sent to m***@example.com. Sign in"],
		["EMAIL_NOT_VERIFIED", "This account's email isn't verified"],
	] as const)(
		"explains %s and offers to switch account",
		async (reason, text) => {
			renderInvite({ [PREVIEW]: preview({ eligible: false, reason }) });
			expect(await screen.findByRole("alert")).toHaveTextContent(text);
			expect(
				screen.queryByRole("button", { name: "Join workspace" }),
			).toBeNull();
			expect(
				screen.getByRole("button", { name: "Sign in with another account" }),
			).toBeInTheDocument();
		},
	);

	it("says a full workspace cannot take more members", async () => {
		renderInvite({
			[PREVIEW]: preview({ eligible: false, reason: "MEMBER_LIMIT" }),
		});
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"The workspace already has as many members as its owner's plan allows.",
		);
		expect(screen.queryByRole("button", { name: "Join workspace" })).toBeNull();
	});

	it("turns a plan limit on accept into the full-workspace state", async () => {
		renderInvite({
			[PREVIEW]: preview(),
			[ACCEPT]: apiError(403, "PLAN_LIMIT_REACHED", { limit: "members" }),
		});
		await userEvent.click(
			await screen.findByRole("button", { name: "Join workspace" }),
		);
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Ask a workspace Admin to free a seat.",
		);
	});

	it("lets members open the workspace they already belong to", async () => {
		renderInvite({
			[PREVIEW]: preview({ eligible: false, reason: "ALREADY_MEMBER" }),
		});
		expect(
			await screen.findByText("You're already a member of Team Payments."),
		).toBeInTheDocument();
		await userEvent.click(
			screen.getByRole("button", { name: "Open workspace" }),
		);
		expect(await screen.findByText("Workbench page")).toBeInTheDocument();
		expect(savedWorkspace()).toBe("w-team");
	});

	it.each([
		[
			apiError(410, "INVITE_EXPIRED", {
				expiresAt: "2026-10-01T01:00:00.000Z",
			}),
			"This invite link has expired",
			"The link expired on Oct 1, 2026.",
		],
		[
			apiError(410, "INVITE_USED"),
			"This invite link has already been used",
			"Each invite link works only once.",
		],
		[
			apiError(404, "INVITE_NOT_FOUND"),
			"This invite link is no longer valid",
			"An Admin cancelled this link, the workspace was deleted, or the link is wrong.",
		],
	])("explains an unusable link (%#)", async (reply, title, text) => {
		renderInvite({ [PREVIEW]: reply });
		expect(
			await screen.findByRole("heading", { level: 1, name: title }),
		).toBeInTheDocument();
		expect(byId("ws-invite-page-invalid")).toHaveTextContent(text);
		expect(
			screen.getByRole("link", { name: "Back to the API client" }),
		).toHaveAttribute("href", "/api-client");
	});
});
