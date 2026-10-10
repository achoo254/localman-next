import { act, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	held,
	watchFor,
} from "../../pages/project-detail/project-detail-test-helpers";
import { seriousViolations } from "../../test/axe";
import { inboxesKey } from "./inbox-api";
import {
	BASE,
	byId,
	inboxJson,
	listJson,
	renderInboxTab,
} from "./inbox-test-utils";

const LIST = { body: listJson([inboxJson("stripe")]) };

describe("inbox tab, loading states", () => {
	beforeEach(() => {
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
	});
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("shows item-shaped placeholders while the list is slow", async () => {
		const list = held();
		const { container } = renderInboxTab(listJson([]), {
			[`GET ${BASE}`]: list.route,
		});
		await waitFor(() => expect(byId("inbox-loading")).not.toBeNull());
		expect(byId("inbox-loading")).toHaveAttribute("aria-busy", "true");
		await waitFor(() =>
			expect(screen.getByRole("status")).toHaveTextContent("Loading inboxes…"),
		);
		expect(await seriousViolations(container)).toEqual([]);
		await act(async () => list.release(LIST));
		await waitFor(() => expect(byId("inbox-item-stripe")).not.toBeNull());
		expect(byId("inbox-loading")).toBeNull();
	});

	it("shows nothing in between when the list answers at once", async () => {
		const seen = watchFor('[data-id="inbox-loading"]');
		renderInboxTab(LIST.body);
		await waitFor(() => expect(byId("inbox-item-stripe")).not.toBeNull());
		expect(seen()).toBe(false);
	});

	it("keeps the inboxes under the panel bar during a slow refetch", async () => {
		let slow: ReturnType<typeof held> | null = null;
		const { queryClient } = renderInboxTab(LIST.body, {
			[`GET ${BASE}`]: () => (slow ? slow.route() : LIST),
		});
		await waitFor(() => expect(byId("inbox-item-stripe")).not.toBeNull());
		const refetch = held();
		slow = refetch;
		act(
			() => void queryClient.invalidateQueries({ queryKey: inboxesKey("p1") }),
		);
		await waitFor(() =>
			expect(
				byId("inbox-panel")?.querySelector('[data-id="panel-progress"]'),
			).toBeTruthy(),
		);
		expect(byId("inbox-item-stripe")).not.toBeNull();
		await act(async () => refetch.release(LIST));
		await waitFor(() =>
			expect(
				byId("inbox-panel")?.querySelector('[data-id="panel-progress"]'),
			).toBeNull(),
		);
	});
});
