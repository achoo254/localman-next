import { createRequestDraft } from "@localman/shared/api-client";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { seriousViolations } from "../../../test/axe";
import { renderWorkbench, stubClientApi } from "./workbench-test-utils";

afterEach(() => vi.unstubAllGlobals());

const tabList = () => screen.getByRole("tablist", { name: "Open requests" });
const tabIds = () =>
	screen.queryByRole("tablist", { name: "Open requests" })
		? within(tabList())
				.getAllByRole("tab")
				.map((tab) => tab.id.replace("api-client-tab-", ""))
		: [];
const tab = (id: string) => {
	const element = document.getElementById(`api-client-tab-${id}`);
	if (!element) throw new Error(`no tab ${id}`);
	return element;
};

/** Blank tabs close without asking; a restored request with a URL is unsaved. */
const blank = (tabId: string) => ({ tabId, draft: createRequestDraft() });
const edited = (tabId: string, name: string) => ({
	tabId,
	draft: createRequestDraft({ name, url: `https://a.test/${tabId}` }),
});

async function openTabMenu(id: string) {
	await screen.findByRole("tablist", { name: "Open requests" });
	fireEvent.contextMenu(tab(id));
	return screen.findByRole("menu");
}

describe("API client tab menu", () => {
	it("closes the tabs to the right, then the other tabs", async () => {
		stubClientApi([blank("t1"), blank("t2"), blank("t3")]);
		renderWorkbench();
		const user = userEvent.setup();

		let menu = await openTabMenu("t3");
		expect(
			within(menu).getByRole("menuitem", { name: "Close tabs to the right" }),
		).toHaveAttribute("aria-disabled", "true");
		await user.keyboard("{Escape}");

		menu = await openTabMenu("t2");
		await user.click(
			within(menu).getByRole("menuitem", { name: "Close tabs to the right" }),
		);
		await waitFor(() => expect(tabIds()).toEqual(["t1", "t2"]));

		menu = await openTabMenu("t2");
		await user.click(
			within(menu).getByRole("menuitem", { name: "Close other tabs" }),
		);
		await waitFor(() => expect(tabIds()).toEqual(["t2"]));
		expect(tab("t2")).toHaveAttribute("aria-selected", "true");
	});

	it("asks once before closing several tabs when some have unsaved changes", async () => {
		stubClientApi([blank("t1"), edited("t2", "Users"), blank("t3")]);
		renderWorkbench();
		const user = userEvent.setup();

		let menu = await openTabMenu("t1");
		await user.click(
			within(menu).getByRole("menuitem", { name: "Close all tabs" }),
		);
		let dialog = await screen.findByRole("dialog", { name: "Close 3 tabs?" });
		expect(dialog).toHaveTextContent(
			"Tabs with changes that are not saved anywhere else: 1.",
		);
		await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
		expect(tabIds()).toEqual(["t1", "t2", "t3"]);

		menu = await openTabMenu("t1");
		await user.click(
			within(menu).getByRole("menuitem", { name: "Close all tabs" }),
		);
		dialog = await screen.findByRole("dialog", { name: "Close 3 tabs?" });
		await user.click(
			within(dialog).getByRole("button", { name: "Discard and close" }),
		);
		await waitFor(() => expect(tabIds()).toEqual([]));
	});

	it("duplicates a request into a new active tab", async () => {
		stubClientApi([edited("t1", "Users")]);
		renderWorkbench();
		const user = userEvent.setup();
		const menu = await openTabMenu("t1");
		await user.click(
			within(menu).getByRole("menuitem", { name: "Duplicate tab" }),
		);
		await waitFor(() => expect(tabIds()).toHaveLength(2));
		const [, copy] = within(tabList()).getAllByRole("tab");
		expect(copy).toHaveTextContent("Users");
		expect(copy).toHaveAttribute("aria-selected", "true");
		expect(screen.getByRole("textbox", { name: "URL" })).toHaveValue(
			"https://a.test/t1",
		);
	});

	it("lists every tab under … to switch to, and closes the unchanged ones", async () => {
		stubClientApi([blank("t1"), edited("t2", "Users")]);
		const { container } = renderWorkbench();
		const user = userEvent.setup();
		await screen.findByRole("tablist", { name: "Open requests" });

		await user.click(screen.getByRole("button", { name: "Tab actions" }));
		let menu = await screen.findByRole("menu");
		expect(within(menu).getByText("Open tabs (2)")).toBeInTheDocument();
		expect(await seriousViolations(container.ownerDocument.body)).toEqual([]);
		await user.click(
			within(menu).getByRole("menuitemradio", { name: /Users/ }),
		);
		await waitFor(() =>
			expect(tab("t2")).toHaveAttribute("aria-selected", "true"),
		);

		await user.click(screen.getByRole("button", { name: "Tab actions" }));
		menu = await screen.findByRole("menu");
		await user.click(
			within(menu).getByRole("menuitem", {
				name: "Close tabs without unsaved changes",
			}),
		);
		await waitFor(() => expect(tabIds()).toEqual(["t2"]));
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
	});
});
