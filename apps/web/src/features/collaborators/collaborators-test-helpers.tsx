import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Project } from "../../pages/projects/projects-api";
import {
	openMenu,
	renderPage,
} from "../../pages/projects/projects-test-helpers";
import { makeProject, makeUser } from "../../test/fixtures";
import type { MockRoute } from "../../test/mock-fetch";
import type { Collaborator } from "./collaborators-api";

export const PROJECT = makeProject("p1", { name: "Demo" });
export const MEMBERS = "/api/v1/projects/p1/collaborators";
export const MAGIC = "/api/v1/projects/p1/magic-link";
export const EXPIRES = "2026-10-16T01:00:00.000Z";

const OWNER_PROFILE = {
	sub: "user-1",
	username: "minhanh",
	name: "Minh Anh",
	picture: null,
};

export function person(
	username: string,
	overrides: Partial<NonNullable<Collaborator["user"]>> = {},
): NonNullable<Collaborator["user"]> {
	return {
		sub: `sub-${username}`,
		username,
		name: username.charAt(0).toUpperCase() + username.slice(1),
		picture: null,
		emailVerified: true,
		...overrides,
	};
}

export function member(
	id: string,
	overrides: Partial<Collaborator> = {},
): Collaborator {
	return {
		id,
		status: "accepted",
		inviteeEmail: null,
		user: person(id),
		invitedAt: "2026-10-09T01:00:00.000Z",
		acceptedAt: "2026-10-09T02:00:00.000Z",
		expiresAt: null,
		...overrides,
	};
}

export function listBody(
	items: Collaborator[],
	{
		max = 3,
		canManage = true,
	}: { max?: number | null; canManage?: boolean } = {},
) {
	const used = 1 + items.filter((item) => item.status !== "expired").length;
	return {
		body: { owner: OWNER_PROFILE, seats: { used, max }, canManage, items },
	};
}

/**
 * The server's member rows: `GET` answers the current rows (background
 * refreshes see earlier writes), `invite` upserts by id like the API.
 */
export function memberStore(
	initial: Collaborator[],
	options: { max?: number | null; canManage?: boolean } = {},
) {
	const items = [...initial];
	return {
		items,
		get: () => listBody(items, options),
		invite(item: Collaborator, extra: Record<string, unknown> = {}) {
			const index = items.findIndex((row) => row.id === item.id);
			if (index >= 0) items[index] = item;
			else items.push(item);
			return {
				status: 201,
				body: {
					collaborator: item,
					inviteLink: `/invite/tok${item.id}`,
					invitee: null,
					notified: false,
					...extra,
				},
			};
		},
	};
}

export function apiError(status: number, code: string, details?: unknown) {
	return { status, body: { error: { code, message: code, details } } };
}

/** Projects page with `project`, then ⋮ → `item` (default "Cộng tác viên"). */
export async function openFromMenu(
	routes: Record<string, MockRoute>,
	{
		project = PROJECT,
		item = "Cộng tác viên",
		user = makeUser(),
		others = [],
	}: {
		project?: Project;
		/** More rows of the projects list, after `project`. */
		others?: Project[];
		item?: string;
		user?: ReturnType<typeof makeUser>;
	} = {},
) {
	const api = renderPage({
		"GET /api/v1/users/me": { body: user },
		"GET /api/v1/projects": { body: { items: [project, ...others] } },
		...routes,
	});
	await openMenu(project.name);
	await userEvent.click(screen.getByRole("menuitem", { name: item }));
	const dialog = await screen.findByRole("dialog", {
		name: new RegExp(`· ${project.name}$`),
	});
	return { ...api, dialog };
}

export const LOOKUP = `POST ${MEMBERS}/lookup`;

/** Types into the invite input and presses "Mời" (one lookup). */
export function typeAndLook(dialog: HTMLElement, text: string) {
	return (async () => {
		await userEvent.type(
			within(dialog).getByLabelText("Username hoặc email"),
			text,
		);
		await userEvent.click(within(dialog).getByRole("button", { name: "Mời" }));
	})();
}
