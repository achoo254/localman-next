import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FLAGS_ON, byId, findRow } from "../collections/collections-test-utils";
import {
	COMMENTS,
	comment,
	openComments,
	openListUsers,
	renderShop,
	thread,
} from "./comments-test-utils";

afterEach(() => vi.unstubAllGlobals());

const OPEN = thread("t1", [
	comment("t1", "Rename **this**?", {
		reactions: [{ key: "heart", count: 2, mine: false }],
	}),
	comment("c2", "Sure", { authorName: "Ada", canEdit: true, canDelete: true }),
]);

describe("comments panel", () => {
	it("lists threads and posts a new one with an @mention", async () => {
		const { calls } = renderShop({
			[`GET ${COMMENTS}`]: { body: { threads: [OPEN] } },
			[`POST ${COMMENTS}`]: { status: 201, body: { id: "n1", threadId: "n1" } },
		});
		const user = await openComments();
		const first = await screen.findByText("this");
		expect(first.tagName).toBe("STRONG");
		expect(byId("comment-thread")).toHaveTextContent("Sure");
		const input = screen.getByRole("combobox", { name: "Write a comment" });
		await user.type(input, "Ping @ev");
		const option = await screen.findByRole("option", { name: /@eve/ });
		expect(option).toHaveTextContent("Eve Tran");
		await user.keyboard("{Enter}");
		expect(input).toHaveValue("Ping @eve ");
		await user.click(screen.getByRole("button", { name: "Comment" }));
		await waitFor(() =>
			expect(calls.find((c) => c.method === "POST")?.body).toEqual({
				body: "Ping @eve",
			}),
		);
	});

	it("reacts, resolves and shows resolved threads on demand", async () => {
		const { calls } = renderShop({
			[`GET ${COMMENTS}`]: ({ query }) => ({
				body: {
					threads:
						query.get("includeResolved") === "true"
							? [
									OPEN,
									thread("t9", [comment("t9", "Done")], {
										resolvedAt: "2026-10-16T02:00:00.000Z",
									}),
								]
							: [OPEN],
				},
			}),
			[`PUT ${COMMENTS}/t1/reactions/heart`]: { body: {} },
			[`PUT ${COMMENTS}/t1/resolution`]: { body: {} },
		});
		const user = await openComments();
		await user.click(await screen.findByRole("button", { name: "Heart, 2" }));
		await user.click(screen.getByRole("button", { name: "Resolve" }));
		await waitFor(() =>
			expect(calls.find((c) => c.path.endsWith("/resolution"))?.body).toEqual({
				resolved: true,
			}),
		);
		expect(calls.some((c) => c.path.endsWith("/reactions/heart"))).toBe(true);
		await user.click(screen.getByRole("checkbox", { name: "Show resolved" }));
		expect(await screen.findByText("Done")).toBeVisible();
		expect(screen.getByText("Resolved")).toBeVisible();
	});

	it("asks before deleting a thread's first comment", async () => {
		const own = thread("t1", [
			comment("t1", "Mine", { canEdit: true, canDelete: true }),
		]);
		const { calls } = renderShop({
			[`GET ${COMMENTS}`]: { body: { threads: [own] } },
			[`DELETE ${COMMENTS}/t1`]: { body: { deleted: true } },
		});
		const user = await openComments();
		await user.click(await screen.findByRole("button", { name: "Delete" }));
		const dialog = await screen.findByRole("dialog", {
			name: "Delete this thread?",
		});
		await user.click(within(dialog).getByRole("button", { name: "Delete" }));
		await waitFor(() =>
			expect(calls.some((c) => c.method === "DELETE")).toBe(true),
		);
	});

	it("is absent while the comments flag is off", async () => {
		renderShop({}, FLAGS_ON);
		const user = userEvent.setup();
		await user.click(await findRow("c1"));
		await waitFor(() => expect(byId("right-rail-info")).not.toBeNull());
		expect(byId("right-rail-comments")).toBeNull();
		expect(byId("collection-header-watch")).toBeNull();
	});
});

describe("watching", () => {
	it("watches the collection from its page", async () => {
		const { calls } = renderShop({
			"PUT /api/v1/collections/c1/watch": {
				body: { collectionId: "c1", watching: true, available: true },
			},
		});
		const user = await openComments();
		const watch = await screen.findByRole("button", { name: "Watch" });
		await user.click(watch);
		expect(
			await screen.findByRole("button", { name: "Watching" }),
		).toHaveAttribute("aria-pressed", "true");
		expect(calls.find((c) => c.method === "PUT")?.body).toEqual({
			watching: true,
		});
	});

	it("is disabled in a personal workspace", async () => {
		renderShop({
			"GET /api/v1/collections/c1/watch": {
				body: { collectionId: "c1", watching: false, available: false },
			},
		});
		await openComments();
		expect(await screen.findByRole("button", { name: "Watch" })).toBeDisabled();
	});
});

describe("inline comments", () => {
	it("comments on text selected in the URL of a saved request", async () => {
		const { calls } = renderShop({
			[`POST ${COMMENTS}`]: { status: 201, body: { id: "n1", threadId: "n1" } },
		});
		const user = await openListUsers();
		const url = screen.getByRole("textbox", { name: "URL" });
		const button = screen.getByRole("button", {
			name: "Comment on the selection",
		});
		expect(button).toBeDisabled();
		(url as HTMLInputElement).setSelectionRange(8, 16);
		fireEvent.select(url);
		await waitFor(() => expect(button).toBeEnabled());
		await user.click(button);
		const dialog = await screen.findByRole("dialog", {
			name: "Comment on the selection",
		});
		expect(dialog).toHaveTextContent("api.test");
		await user.type(
			within(dialog).getByRole("combobox", { name: "Write a comment" }),
			"Staging host?",
		);
		await user.click(within(dialog).getByRole("button", { name: "Comment" }));
		await waitFor(() =>
			expect(calls.find((c) => c.method === "POST")?.body).toEqual({
				nodeId: "r1",
				body: "Staging host?",
				anchor: { part: "url", start: 8, end: 16, quote: "api.test" },
			}),
		);
	});
});
