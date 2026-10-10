import { waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { FeaturesContext, NO_FEATURES } from "../../config/features";
import { makeUser } from "../../test/fixtures";
import { type MockRoute, mockFetch } from "../../test/mock-fetch";
import { renderRoutes } from "../../test/render-app";
import { resetCurrentUserCache } from "../auth/use-current-user";
import {
	resetWorkspaceSelection,
	workspaceStorageKey,
} from "./current-workspace";
import type {
	WorkspaceInvitation,
	WorkspaceMember,
} from "./workspace-members-api";
import { WorkspaceSettingsPage } from "./workspace-settings-page";
import type { Workspace } from "./workspaces-api";

export const LIST = "GET /api/v1/workspaces";
export const TEAM_PATH = "/api/v1/workspaces/w-team";
export const MEMBERS = `${TEAM_PATH}/members`;

export const PERSONAL: Workspace = {
	id: "w-personal",
	name: "Minh Anh's workspace",
	description: null,
	type: "personal",
	role: "admin",
	memberCount: 1,
};

export const TEAM: Workspace = {
	id: "w-team",
	name: "Team Payments",
	description: "Payment APIs",
	type: "team",
	role: "admin",
	memberCount: 2,
};

export function teamMember(
	username: string,
	overrides: Partial<WorkspaceMember> = {},
): WorkspaceMember {
	return {
		id: `m-${username}`,
		userId: `sub-${username}`,
		username,
		name: username.charAt(0).toUpperCase() + username.slice(1),
		picture: null,
		role: "editor",
		isYou: false,
		...overrides,
	};
}

export const ME = teamMember("minhanh", {
	name: "Minh Anh",
	role: "admin",
	isYou: true,
});

export function invitation(
	id: string,
	overrides: Partial<WorkspaceInvitation> = {},
): WorkspaceInvitation {
	return {
		id,
		kind: "account",
		username: "hoa",
		email: null,
		role: "editor",
		expiresAt: "2026-10-17T01:00:00.000Z",
		expired: false,
		emailVerified: true,
		...overrides,
	};
}

export function membersBody(
	members: WorkspaceMember[],
	invitations: WorkspaceInvitation[] = [],
	max: number | null = 3,
) {
	const used = members.length + invitations.filter((i) => !i.expired).length;
	return { body: { members, invitations, seats: { used, max } } };
}

export function apiError(status: number, code: string, details?: unknown) {
	return { status, body: { error: { code, message: code, details } } };
}

/** The saved choice of `makeUser()`, whose sub is `user-1`. */
const STORAGE_KEY = workspaceStorageKey(makeUser().sub);

/** Saves `workspaceId` as the current workspace before rendering. */
export function chooseWorkspace(workspaceId: string | null): void {
	resetCurrentUserCache();
	resetWorkspaceSelection();
	window.localStorage.clear();
	if (workspaceId) window.localStorage.setItem(STORAGE_KEY, workspaceId);
}

export function savedWorkspace(): string | null {
	return window.localStorage.getItem(STORAGE_KEY);
}

export const FLAGS_ON = { ...NO_FEATURES, apiClient: true, workspaces: true };

/** `element` at `path` with the workspaces flag, plus stand-in pages. */
export function renderWithWorkspaces(
	routes: Record<string, MockRoute>,
	{
		path,
		element,
		at,
		flags = FLAGS_ON,
		workbench = <p>Workbench page</p>,
	}: {
		path: string;
		element: ReactNode;
		at: string;
		flags?: typeof FLAGS_ON;
		/** What `/api-client` shows, under the same flags. */
		workbench?: ReactNode;
	},
) {
	const api = mockFetch({
		"GET /api/v1/users/me": { body: makeUser() },
		[LIST]: { body: { items: [PERSONAL, TEAM] } },
		...routes,
	});
	const standIns = [
		{
			path: "/api-client",
			element: <FeaturesContext value={flags}>{workbench}</FeaturesContext>,
		},
		{ path: "/pricing", element: <p>Pricing page</p> },
	].filter((route) => route.path !== path);
	const view = renderRoutes(
		[
			{
				path,
				element: <FeaturesContext value={flags}>{element}</FeaturesContext>,
			},
			...standIns,
		],
		at,
	);
	return { ...api, ...view };
}

/** `/workspace/settings` (optionally `?tab=members`) of the saved workspace. */
export function renderSettings(
	routes: Record<string, MockRoute>,
	{ tab, flags }: { tab?: "members"; flags?: typeof FLAGS_ON } = {},
) {
	return renderWithWorkspaces(routes, {
		path: "/workspace/settings",
		element: <WorkspaceSettingsPage />,
		at: tab ? "/workspace/settings?tab=members" : "/workspace/settings",
		flags,
	});
}

export const byId = (id: string) =>
	document.querySelector<HTMLElement>(`[data-id="${id}"]`);
export const allById = (id: string) => [
	...document.querySelectorAll<HTMLElement>(`[data-id="${id}"]`),
];

export function findMembersPane(): Promise<HTMLElement> {
	return waitFor(() => {
		const pane = byId("ws-settings-members");
		if (!pane) throw new Error("members pane not shown");
		return pane;
	});
}

/** The server's member rows: `GET` answers the current list. */
export function memberStore(
	members: WorkspaceMember[],
	max: number | null = 3,
) {
	const rows = [...members];
	return { rows, get: () => membersBody(rows, [], max) };
}
