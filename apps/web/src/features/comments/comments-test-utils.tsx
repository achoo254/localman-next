/** A team collection with comments, as the comment tests serve it. */
import type {
	CommentThreadView,
	CommentView,
} from "@localman/shared/api-client";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { MockRoute } from "../../test/mock-fetch";
import {
	FLAGS_ON,
	LIST_PATH,
	detail,
	findRow,
	renderWorkbenchPage,
	request,
	summary,
} from "../collections/collections-test-utils";

export const COMMENTS = "/api/v1/collections/c1/comments";
export const FLAGS = { ...FLAGS_ON, comments: true };

export function comment(
	id: string,
	body: string,
	overrides: Partial<CommentView> = {},
): CommentView {
	return {
		id,
		authorId: "u2",
		authorName: "Lan",
		body,
		createdAt: "2026-10-16T01:00:00.000Z",
		editedAt: null,
		reactions: [],
		canEdit: false,
		canDelete: false,
		...overrides,
	};
}

export function thread(
	id: string,
	comments: CommentView[],
	overrides: Partial<CommentThreadView> = {},
): CommentThreadView {
	return {
		id,
		nodeId: null,
		changeKey: null,
		anchor: null,
		resolvedAt: null,
		resolvedBy: null,
		canResolve: true,
		comments,
		...overrides,
	};
}

const LIST_USERS = request("r1", null, "a0", "List users");
export const SHOP = detail("c1", [LIST_USERS], { name: "Shop" });

export function renderShop(
	routes: Record<string, MockRoute> = {},
	flags = FLAGS,
) {
	return renderWorkbenchPage(
		{
			[`GET ${LIST_PATH}`]: {
				body: { items: [summary("c1", { name: "Shop", requestCount: 1 })] },
			},
			"GET /api/v1/collections/c1": { body: SHOP },
			"GET /api/v1/collections/c1/watch": {
				body: { collectionId: "c1", watching: false, available: true },
			},
			"GET /api/v1/collections/c1/comment-counts": { body: { counts: {} } },
			"GET /api/v1/workspaces/w-team/members": {
				body: {
					members: [
						{
							id: "m1",
							userId: "u3",
							username: "eve",
							name: "Eve Tran",
							picture: null,
							role: "editor",
							isYou: false,
						},
					],
					invitations: [],
					seats: null,
				},
			},
			[`GET ${COMMENTS}`]: { body: { threads: [] } },
			...routes,
		},
		{ flags },
	);
}

/** Opens the collection page and its Comments panel. */
export async function openComments() {
	const user = userEvent.setup();
	await user.click(await findRow("c1"));
	await user.click(await screen.findByRole("button", { name: "Comments" }));
	return user;
}

/** Opens the bound request "List users" as a tab. */
export async function openListUsers() {
	const user = userEvent.setup();
	await user.click(await findRow("c1"));
	await user.click(await findRow("r1"));
	await screen.findByRole("tab", { name: /List users/ });
	return user;
}
