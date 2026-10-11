import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	chooseWorkspace,
	renderWithWorkspaces,
} from "../workspaces/workspaces-test-helpers";
import { allById } from "./collections-test-utils";
import { TrashPage } from "./trash-page";

afterEach(() => vi.unstubAllGlobals());

const ITEM = {
	id: "t1",
	name: "Orders API",
	workspaceId: "w-team",
	workspaceName: "Team Payments",
	deletedAt: "2026-10-01T00:00:00.000Z",
	deletedBy: "user-1",
	deletedByName: "Minh Anh",
	purgeAt: "2026-10-31T00:00:00.000Z",
	requestCount: 0,
};

async function restoreWith(code: string, status: number) {
	chooseWorkspace("w-team");
	renderWithWorkspaces(
		{
			"GET /api/v1/trash/collections": { body: { items: [ITEM] } },
			"POST /api/v1/trash/collections/t1/restore": {
				status,
				body: { error: { code, message: code } },
			},
		},
		{ path: "/trash", at: "/trash", element: <TrashPage /> },
	);
	const user = userEvent.setup();
	await waitFor(() => expect(allById("trash-item")).toHaveLength(1));
	expect(screen.getByText("0 requests")).toBeVisible();
	await user.click(screen.getByRole("button", { name: "Restore Orders API" }));
	const dialog = await screen.findByRole("dialog");
	await user.click(within(dialog).getByRole("button", { name: "Restore" }));
	return dialog;
}

describe("trash restore errors", () => {
	it("explains a team collection cannot go to a personal workspace", async () => {
		const dialog = await restoreWith("TEAM_TO_PERSONAL", 409);
		expect(
			await within(dialog).findByText(
				"A team collection can't move to a personal workspace.",
			),
		).toBeVisible();
	});

	it("explains a role that no longer allows it", async () => {
		const dialog = await restoreWith("FORBIDDEN", 403);
		expect(
			await within(dialog).findByText(
				"Your role doesn't allow this. Ask an Admin or Editor.",
			),
		).toBeVisible();
	});
});
