/** A collection with a changelog, as the changelog tests serve it. */
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect } from "vitest";
import type { MockRoute } from "../../test/mock-fetch";
import {
	LIST_PATH,
	byId,
	detail,
	findRow,
	renderWorkbenchPage,
	summary,
} from "./collections-test-utils";

export const LOG = "/api/v1/collections/c1/changelog";
export const change = (id: string, hidden = false) => ({
	id,
	at: "2026-10-10T01:00:00.000Z",
	action: "update",
	entity: "node",
	entityId: "f1",
	entityKind: "folder",
	entityName: "Users",
	fields: ["name"],
	summary: "name",
	hidden,
	restorable: true,
});
export const PAGE = (nextBefore: string | null, id = "rv1") => ({
	sessions: [
		{
			authorId: "u1",
			authorName: "Minh Anh",
			from: "2026-10-10T01:00:00.000Z",
			to: "2026-10-10T01:00:00.000Z",
			changes: [change(id)],
		},
	],
	nextBefore,
});

export function renderShop(routes: Record<string, MockRoute> = {}) {
	return renderWorkbenchPage({
		[`GET ${LIST_PATH}`]: {
			body: { items: [summary("c1", { name: "Shop" })] },
		},
		"GET /api/v1/collections/c1": {
			body: detail("c1", [], {
				name: "Shop",
				createdByName: "Minh Anh",
				updatedByName: "Lan",
			}),
		},
		[`GET ${LOG}`]: ({ query }) => ({
			body: query.get("before") ? PAGE(null, "rv0") : PAGE("5"),
		}),
		[`GET ${LOG}/rv1/diff`]: {
			body: {
				revisionId: "rv1",
				hidden: false,
				available: true,
				before: { name: "Team" },
				after: { name: "Users" },
			},
		},
		"GET /api/v1/collections/c1/activity": {
			body: {
				items: [{ ...change("rv1"), authorId: "u1", authorName: "Minh Anh" }],
			},
		},
		...routes,
	});
}

export async function openChangelog() {
	const user = userEvent.setup();
	await user.click(await findRow("c1"));
	await user.click(await screen.findByRole("button", { name: "Changelog" }));
	await waitFor(() => expect(byId("changelog-session")).not.toBeNull());
	return user;
}
