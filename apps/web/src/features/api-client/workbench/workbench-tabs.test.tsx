import { createRequestDraft } from "@localman/shared/api-client";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { seriousViolations } from "../../../test/axe";
import {
	byDataId,
	renderWorkbench,
	stubClientApi,
} from "./workbench-test-utils";

afterEach(() => vi.unstubAllGlobals());

/** Tabs of the tab bar (the request's own part tabs excluded). */
const requestTabs = () =>
	screen.queryByRole("tablist", { name: "Open requests" })
		? within(
				screen.getByRole("tablist", { name: "Open requests" }),
			).getAllByRole("tab")
		: [];
const findRequestTabs = async () => {
	await screen.findByRole("tablist", { name: "Open requests" });
	return requestTabs();
};

const saved = (calls: ReturnType<typeof stubClientApi>, method: string) =>
	calls.filter(
		(call) =>
			call.method === method && call.path.startsWith("/api/v1/client/drafts/"),
	);

describe("API client tabs", () => {
	it("restores the tabs saved on the server, the first one active", async () => {
		stubClientApi([
			{
				tabId: "t1",
				draft: createRequestDraft({
					name: "Users",
					url: "https://a.test/users",
				}),
			},
			{
				tabId: "t2",
				draft: createRequestDraft({
					method: "DELETE",
					url: "https://a.test/users/1",
				}),
			},
		]);
		renderWorkbench();
		const tabs = await findRequestTabs();
		expect(tabs.map((tab) => tab.getAttribute("aria-selected"))).toEqual([
			"true",
			"false",
		]);
		expect(tabs[1]).toHaveTextContent("DEL");
		expect(screen.getByRole("textbox", { name: "URL" })).toHaveValue(
			"https://a.test/users",
		);
		expect(
			await screen.findByText("Drafts saved to your account"),
		).toBeInTheDocument();
		expect(
			await screen.findByText("Proxy: 12/5,000 this month"),
		).toBeInTheDocument();
	});

	it("shows the empty editor, then saves a new tab's draft once typing stops", async () => {
		const calls = stubClientApi();
		renderWorkbench({ saveDelayMs: 30 });
		const user = userEvent.setup();
		await screen.findByText("Drafts saved to your account");
		await user.click(byDataId("editor-empty-new"));
		fireEvent.change(screen.getByRole("textbox", { name: "URL" }), {
			target: { value: "https://a.test/x?id=1" },
		});
		// Wait for the save of the typed URL itself: on a slow runner the blank
		// new tab is saved first, and a save still pending at the end of the
		// test would land in the next test's calls.
		await waitFor(() =>
			expect(saved(calls, "PUT").at(-1)?.body).toMatchObject({
				order: 0,
				draft: { url: "https://a.test/x?id=1" },
			}),
		);
		expect(screen.getByRole("tab", { name: /a\.test\/x/ })).toBeInTheDocument();
		expect(byDataId("tabbar-tab-dirty")).toBeInTheDocument();
	});

	it("saves at once with Ctrl+S instead of waiting", async () => {
		const calls = stubClientApi();
		renderWorkbench({ saveDelayMs: 60_000 });
		await screen.findByText("Drafts saved to your account");
		fireEvent.click(byDataId("tabbar-new"));
		const url = screen.getByRole("textbox", { name: "URL" });
		fireEvent.change(url, { target: { value: "https://a.test/now" } });
		expect(saved(calls, "PUT")).toEqual([]);
		fireEvent.keyDown(url, { key: "s", ctrlKey: true });
		await waitFor(() =>
			expect(saved(calls, "PUT").at(-1)?.body).toMatchObject({
				draft: { url: "https://a.test/now" },
			}),
		);
		expect(await screen.findByText("Draft saved")).toBeInTheDocument();
	});

	it("closes a clean tab at once and asks before closing an edited one", async () => {
		const calls = stubClientApi([
			{ tabId: "t1", draft: createRequestDraft() },
			{
				tabId: "t2",
				draft: createRequestDraft({ url: "https://a.test/edited" }),
			},
		]);
		renderWorkbench();
		const user = userEvent.setup();
		const [blank] = await findRequestTabs();
		if (!blank) throw new Error("no tab");
		blank.focus();
		await user.keyboard("{Delete}");
		await waitFor(() => expect(requestTabs()).toHaveLength(1));
		await waitFor(() =>
			expect(saved(calls, "DELETE")[0]?.path).toBe("/api/v1/client/drafts/t1"),
		);

		const [edited] = requestTabs();
		if (!edited) throw new Error("no tab");
		fireEvent.click(
			within(edited.parentElement ?? edited).getByTitle("Close tab (Delete)", {
				exact: false,
			}),
		);
		const dialog = await screen.findByRole("dialog", {
			name: "Close this tab?",
		});
		await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
		expect(requestTabs()).toHaveLength(1);

		edited.focus();
		await user.keyboard("{Delete}");
		await user.click(
			await screen.findByRole("button", { name: "Discard and close" }),
		);
		await waitFor(() => expect(requestTabs()).toEqual([]));
		await waitFor(() =>
			expect(saved(calls, "DELETE").map((c) => c.path)).toContain(
				"/api/v1/client/drafts/t2",
			),
		);
		expect(byDataId("editor-empty")).toBeInTheDocument();
	});

	it("moves between tabs with the arrow keys", async () => {
		stubClientApi([
			{ tabId: "t1", draft: createRequestDraft({ name: "One" }) },
			{ tabId: "t2", draft: createRequestDraft({ name: "Two" }) },
		]);
		renderWorkbench();
		const user = userEvent.setup();
		(await screen.findByRole("tab", { name: /One/ })).focus();
		await user.keyboard("{ArrowRight}");
		expect(screen.getByRole("tab", { name: /Two/ })).toHaveAttribute(
			"aria-selected",
			"true",
		);
		expect(screen.getByRole("tab", { name: /Two/ })).toHaveFocus();
		await user.keyboard("{Home}");
		expect(screen.getByRole("tab", { name: /One/ })).toHaveAttribute(
			"aria-selected",
			"true",
		);
	});

	it("has no serious accessibility violations", async () => {
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
		stubClientApi([
			{
				tabId: "t1",
				draft: createRequestDraft({ url: "https://a.test/{{id}}" }),
			},
		]);
		const { container } = renderWorkbench();
		await findRequestTabs();
		expect(await seriousViolations(container)).toEqual([]);
	});
});
