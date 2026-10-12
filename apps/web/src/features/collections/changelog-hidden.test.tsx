import { screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LOG, change, openChangelog, renderShop } from "./changelog-test-utils";
import { LIST_PATH, byId, detail, summary } from "./collections-test-utils";

afterEach(() => vi.unstubAllGlobals());

const HIDDEN_PAGE = {
	sessions: [
		{
			authorId: "u1",
			authorName: "Minh Anh",
			from: "2026-10-10T01:00:00.000Z",
			to: "2026-10-10T01:00:00.000Z",
			changes: [change("rv1", true)],
		},
	],
	nextBefore: null,
};
const HIDDEN_DIFF = {
	revisionId: "rv1",
	hidden: true,
	available: true,
	before: { name: "Team" },
	after: { name: "Users" },
};

/** The changelog with one hidden change, seen with `role` on the collection. */
function renderHidden(role: "editor" | "viewer") {
	return renderShop({
		[`GET ${LIST_PATH}`]: {
			body: { items: [summary("c1", { name: "Shop", role })] },
		},
		"GET /api/v1/collections/c1": {
			body: detail("c1", [], { name: "Shop", role }),
		},
		[`GET ${LOG}`]: { body: HIDDEN_PAGE },
		[`GET ${LOG}/rv1/diff`]: { body: HIDDEN_DIFF },
	});
}

describe("hidden diffs and restore rights", () => {
	it("still shows an Editor a hidden diff, with a note", async () => {
		renderHidden("editor");
		const user = await openChangelog();
		await user.click(screen.getByRole("button", { name: "View diff" }));
		expect(
			await screen.findByText(
				"This diff is hidden from viewers. You can see it because you're an editor.",
			),
		).toBeVisible();
		expect(
			await screen.findByRole("region", { name: "Changes to Users" }),
		).toBeVisible();
		expect(screen.getByRole("button", { name: "Show diff" })).toBeVisible();
		expect(screen.getByRole("button", { name: "Restore" })).toBeEnabled();
	});

	it("tells a Viewer the diff is hidden and why Restore is off", async () => {
		const { calls } = renderHidden("viewer");
		const user = await openChangelog();
		const item = byId("changelog-change") as HTMLElement;
		await user.click(within(item).getByRole("button", { name: "View diff" }));
		expect(
			await within(item).findByText("Diff hidden by an editor."),
		).toBeVisible();
		expect(calls.some((c) => c.path === `${LOG}/rv1/diff`)).toBe(false);
		expect(
			within(item).queryByRole("button", { name: "Show diff" }),
		).toBeNull();
		const restore = within(item).getByRole("button", { name: "Restore" });
		expect(restore).toBeDisabled();
		const note = byId("changelog-viewer-note");
		expect(note).toHaveTextContent("Only editors can restore a change.");
		expect(restore).toHaveAttribute("aria-describedby", note?.id);
	});
});
