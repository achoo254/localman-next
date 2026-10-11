import { createRequestDraft } from "@localman/shared/api-client";
import { renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { makeUser } from "../../test/fixtures";
import { useLogout } from "../auth/use-logout";
import {
	FLAGS_OFF,
	LIST_PATH,
	byId,
	detail,
	renderWorkbenchPage,
	summary,
} from "./collections-test-utils";
import { pagesStorageKey, readPages } from "./page-storage";

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

const KEY = pagesStorageKey(makeUser().sub);
const PAGE = {
	id: "collection-c1",
	kind: "collection",
	collectionId: "c1",
	nodeId: null,
	name: "Shop",
};
const SAVED = { [KEY]: JSON.stringify([PAGE]) };

const routes = {
	[`GET ${LIST_PATH}`]: { body: { items: [summary("c1", { name: "Shop" })] } },
	"GET /api/v1/collections/c1": { body: detail("c1", [], { name: "Shop" }) },
};

const writes = (spy: { mock: { calls: unknown[][] } }) =>
	spy.mock.calls.filter(([key]) => key === KEY).map(([, value]) => value);

describe("collection tabs after a reload", () => {
	it("keeps only readable pages", () => {
		window.localStorage.setItem(KEY, JSON.stringify([PAGE, { id: 1 }, "x"]));
		expect(readPages(makeUser().sub)).toEqual([PAGE]);
		window.localStorage.setItem(KEY, "{not json");
		expect(readPages(makeUser().sub)).toEqual([]);
	});

	it("reopens the pages of the last visit with the right rail", async () => {
		const setItem = vi.spyOn(Storage.prototype, "setItem");
		renderWorkbenchPage(routes, { storage: SAVED });
		expect(await screen.findByRole("tab", { name: /Shop/ })).toBeVisible();
		expect(
			await screen.findByRole("textbox", { name: "Collection name" }),
		).toHaveValue("Shop");
		expect(byId("right-rail")).not.toBeNull();
		// Never written over before the saved pages are back.
		await waitFor(() => expect(writes(setItem).length).toBeGreaterThan(1));
		expect(writes(setItem).slice(1)).not.toContain("[]");
		expect(JSON.parse(window.localStorage.getItem(KEY) ?? "[]")).toEqual([
			PAGE,
		]);
	});

	it("keeps the request tab that was active before the reload", async () => {
		const draft = createRequestDraft({ name: "Ping", url: "https://a.test" });
		renderWorkbenchPage(
			{
				...routes,
				"GET /api/v1/client/drafts": {
					body: {
						items: [{ tabId: "t1", order: 0, draft, updatedAt: "2026-10-10" }],
					},
				},
			},
			{ storage: SAVED },
		);
		expect(await screen.findByRole("tab", { name: /Shop/ })).toHaveAttribute(
			"aria-selected",
			"false",
		);
		expect(screen.getByRole("tab", { name: /Ping/ })).toHaveAttribute(
			"aria-selected",
			"true",
		);
	});

	it("does nothing of this while the workspaces flag is off", async () => {
		renderWorkbenchPage(routes, { flags: FLAGS_OFF, storage: SAVED });
		expect(
			await screen.findByRole("button", { name: "History" }),
		).toBeVisible();
		expect(screen.queryByRole("tab", { name: /Shop/ })).toBeNull();
		expect(byId("right-rail")).toBeNull();
	});

	it("forgets the saved pages of every account on sign-out", async () => {
		window.localStorage.setItem(KEY, JSON.stringify([PAGE]));
		window.localStorage.setItem(pagesStorageKey("other"), "[]");
		window.localStorage.setItem("localman-theme", "dark");
		const { result } = renderHook(() => useLogout("logout-form"));
		await result.current.logout();
		expect(window.localStorage.getItem(KEY)).toBeNull();
		expect(window.localStorage.getItem(pagesStorageKey("other"))).toBeNull();
		expect(window.localStorage.getItem("localman-theme")).toBe("dark");
	});
});
