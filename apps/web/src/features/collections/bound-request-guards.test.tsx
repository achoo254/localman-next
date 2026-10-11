import { createRequestDraft } from "@localman/shared/api-client";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FetchCall, MockReply, MockRoute } from "../../test/mock-fetch";
import {
	LIST_PATH,
	byId,
	detail,
	findRow,
	folder,
	openMenu,
	renderWorkbenchPage,
	request,
	summary,
} from "./collections-test-utils";

afterEach(() => vi.unstubAllGlobals());

const NODE = "/api/v1/collections/c1/nodes/r1";
const LIST_USERS = request("r1", "f1", "a0", "List users");
const shop = (role: "editor" | "viewer" = "editor") =>
	detail("c1", [folder("f1", null, "a0", "Users"), LIST_USERS], {
		name: "Shop",
		role,
	});

function renderShop(
	routes: Record<string, MockRoute> = {},
	role: "editor" | "viewer" = "editor",
) {
	return renderWorkbenchPage({
		[`GET ${LIST_PATH}`]: {
			body: { items: [summary("c1", { name: "Shop", role })] },
		},
		"GET /api/v1/collections/c1": { body: shop(role) },
		...routes,
	});
}

async function openListUsers() {
	const user = userEvent.setup();
	await user.click(await findRow("c1"));
	await user.click(await findRow("f1"));
	await user.click(await findRow("r1"));
	await screen.findByRole("tab", { name: /List users/ });
	return user;
}

const patchesTo = (calls: FetchCall[], path: string) =>
	calls.filter((c) => c.method === "PATCH" && c.path === path);

describe("saving bound requests safely", () => {
	it("keeps a Viewer's Ctrl+S to the draft only", async () => {
		const { calls } = renderShop({}, "viewer");
		const user = await openListUsers();
		await user.type(screen.getByRole("textbox", { name: "URL" }), "?x=1");
		expect(byId("request-head-save")).toBeNull();
		await user.keyboard("{Control>}s{/Control}");
		await waitFor(() =>
			expect(calls.some((c) => c.method === "PUT")).toBe(true),
		);
		expect(patchesTo(calls, NODE)).toHaveLength(0);
	});

	it("saves once while a save is on its way", async () => {
		let answer: (reply: MockReply) => void = () => {};
		const { calls } = renderShop({
			[`PATCH ${NODE}`]: () =>
				new Promise<MockReply>((resolve) => {
					answer = resolve;
				}),
		});
		const user = await openListUsers();
		await user.type(screen.getByRole("textbox", { name: "URL" }), "?x=1");
		await user.keyboard("{Control>}s{/Control}");
		await user.keyboard("{Control>}s{/Control}");
		answer({ body: LIST_USERS });
		await waitFor(() => expect(screen.queryByText("Unsaved")).toBeNull());
		expect(patchesTo(calls, NODE)).toHaveLength(1);
	});

	it("follows a sidebar rename instead of putting the old name back", async () => {
		const renamed = { ...LIST_USERS, name: "Users list" };
		const { calls } = renderShop({ [`PATCH ${NODE}`]: { body: renamed } });
		const user = await openListUsers();
		await openMenu("r1");
		await user.click(screen.getByRole("menuitem", { name: "Rename" }));
		const box = await screen.findByRole("textbox", {
			name: "New name for List users",
		});
		await user.clear(box);
		await user.type(box, "Users list{Enter}");
		expect(
			await screen.findByRole("tab", { name: /Users list/ }),
		).toBeVisible();
		expect(screen.queryByText("Unsaved")).toBeNull();
		await user.click(byId("request-head-save") as HTMLElement);
		await waitFor(() => expect(patchesTo(calls, NODE)).toHaveLength(2));
		expect(patchesTo(calls, NODE)[1]?.body).not.toHaveProperty("name");
	});

	it("relabels an open folder tab renamed in the sidebar", async () => {
		const renamed = { ...folder("f1", null, "a0", "Team") };
		renderShop({
			"PATCH /api/v1/collections/c1/nodes/f1": { body: renamed },
		});
		const user = userEvent.setup();
		await user.click(await findRow("c1"));
		await user.click(await findRow("f1"));
		await screen.findByRole("tab", { name: /Users/ });
		await openMenu("f1");
		await user.click(screen.getByRole("menuitem", { name: "Rename" }));
		const box = await screen.findByRole("textbox", {
			name: "New name for Users",
		});
		await user.clear(box);
		await user.type(box, "Team{Enter}");
		expect(await screen.findByRole("tab", { name: /Team/ })).toBeVisible();
	});

	it("does not send a request whose collection cannot be read", async () => {
		const draft = createRequestDraft({
			name: "Orphan",
			url: "https://a.test",
			auth: { type: "inherit" },
		});
		renderWorkbenchPage({
			[`GET ${LIST_PATH}`]: { body: { items: [] } },
			"GET /api/v1/client/drafts": {
				body: {
					items: [
						{
							tabId: "t1",
							order: 0,
							draft,
							source: { collectionId: "gone", nodeId: "r1" },
							updatedAt: "2026-10-10T00:00:00Z",
						},
					],
				},
			},
			"GET /api/v1/collections/gone": {
				status: 404,
				body: { error: { code: "NOT_FOUND", message: "nope" } },
			},
		});
		const user = userEvent.setup();
		await screen.findByRole("tab", { name: /Orphan/ });
		await user.click(screen.getByRole("button", { name: "Send" }));
		expect(await screen.findByText(/Not sent: its collection/)).toBeVisible();
		expect(screen.queryByText("echo GET https://a.test")).toBeNull();
		await user.click(screen.getByRole("tab", { name: "Authorization" }));
		const note = byId("auth-inherit-source") as HTMLElement;
		expect(
			await within(note).findByText(/We couldn't read its collection/),
		).toBeVisible();
	});
});
