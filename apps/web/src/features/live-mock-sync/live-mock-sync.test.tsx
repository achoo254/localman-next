import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MockRoute } from "../../test/mock-fetch";
import {
	FLAGS_ON,
	LIST_PATH,
	byId,
	detail,
	findRow,
	renderWorkbenchPage,
	request,
	summary,
} from "../collections/collections-test-utils";

afterEach(() => vi.unstubAllGlobals());

const FLAGS = { ...FLAGS_ON, liveMockSync: true };
const C = "/api/v1/collections/c1";
const SYNC = `${C}/mock-sync`;

const status = (overrides: object = {}) => ({
	collectionId: "c1",
	project: { id: "p1", name: "Shop mock" },
	environmentId: null,
	lastSyncedAt: "2026-10-23T01:00:00.000Z",
	syncCount: 1,
	conflicts: 0,
	canManage: true,
	canResolve: true,
	...overrides,
});

const CONFLICT = {
	id: "mock:u:GET:collection:draft.url",
	entityKind: "request",
	key: "mock:u:GET:collection",
	name: "List users",
	path: "draft.url",
	base: "{{baseUrl}}/users",
	source: "{{baseUrl}}/members",
	destination: "{{baseUrl}}/people",
};

function renderShop(routes: Record<string, MockRoute>) {
	return renderWorkbenchPage(
		{
			[`GET ${LIST_PATH}`]: {
				body: { items: [summary("c1", { name: "Shop" })] },
			},
			[`GET ${C}`]: {
				body: detail("c1", [request("r1", null, "a0", "List users")], {
					name: "Shop",
					mockProject: { id: "p1", name: "Shop mock" },
				}),
			},
			...routes,
		},
		{ flags: FLAGS },
	);
}

async function openShop() {
	const user = userEvent.setup();
	await user.click(await findRow("c1"));
	return user;
}

describe("Live Mock Sync on the collection page", () => {
	it("shows the badge and turns the sync off from its settings", async () => {
		const { calls } = renderShop({
			[`GET ${SYNC}`]: { body: status() },
			[`DELETE ${SYNC}`]: { body: { stopped: true } },
		});
		const user = await openShop();
		const badge = await waitFor(() => {
			const found = byId("collection-meta-sync");
			expect(found).not.toBeNull();
			return found as HTMLElement;
		});
		expect(badge).toHaveTextContent("Synced with mock");
		await user.click(badge);
		const dialog = await screen.findByRole("dialog", {
			name: "Live Mock Sync · Shop",
		});
		expect(within(dialog).getByText("Shop mock")).toBeInTheDocument();
		await user.click(
			within(dialog).getByRole("switch", { name: "Sync from mock" }),
		);
		await user.click(within(dialog).getByRole("button", { name: "Save" }));
		await waitFor(() =>
			expect(calls.some((c) => c.method === "DELETE" && c.path === SYNC)).toBe(
				true,
			),
		);
	});

	it("keeps the switch off for those who cannot manage it", async () => {
		renderShop({ [`GET ${SYNC}`]: { body: status({ canManage: false }) } });
		const user = await openShop();
		await waitFor(() => expect(byId("collection-meta-sync")).not.toBeNull());
		await user.click(byId("collection-meta-sync") as HTMLElement);
		const dialog = await screen.findByRole("dialog");
		expect(within(dialog).getByRole("switch")).toBeDisabled();
		expect(byId("modal-sync-settings-need-editor")).not.toBeNull();
	});

	it("shows nothing for a collection that does not follow a mock", async () => {
		renderShop({
			[`GET ${SYNC}`]: {
				status: 404,
				body: { error: { code: "NOT_SYNCED", message: "Not synced" } },
			},
		});
		await openShop();
		await waitFor(() => expect(byId("collection-meta-mock")).not.toBeNull());
		expect(byId("collection-meta-sync")).toBeNull();
		expect(byId("banner-sync-conflict")).toBeNull();
	});

	it("resolves conflicts from the banner with Keep mine", async () => {
		const { calls } = renderShop({
			[`GET ${SYNC}`]: { body: status({ conflicts: 1 }) },
			[`GET ${SYNC}/preview`]: { body: { changes: [], conflicts: [CONFLICT] } },
			[`POST ${SYNC}/resolve`]: { body: status() },
		});
		const user = await openShop();
		await waitFor(() => expect(byId("banner-sync-conflict")).not.toBeNull());
		expect(byId("banner-sync-conflict")).toHaveTextContent(
			"The mock changed fields you edited",
		);
		await user.click(byId("banner-sync-conflict-resolve") as HTMLElement);
		const dialog = await screen.findByRole("dialog", {
			name: "Changes from Shop mock",
		});
		await user.click(
			await within(dialog).findByRole("radio", { name: /Keep mine/ }),
		);
		await user.click(within(dialog).getByRole("button", { name: "Apply" }));
		await waitFor(() =>
			expect(calls.find((c) => c.method === "POST")?.body).toEqual({
				resolutions: { [CONFLICT.id]: "destination" },
			}),
		);
	});
});
