import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderShop } from "./changelog-test-utils";
import { byId, findRow } from "./collections-test-utils";

afterEach(() => vi.unstubAllGlobals());

/** Every media query matches: the sidebar is open and the panel is a drawer. */
function narrowScreen() {
	vi.stubGlobal("matchMedia", (query: string) => ({
		matches: true,
		media: query,
		addEventListener: () => {},
		removeEventListener: () => {},
	}));
}

async function openPanel(name: "Info" | "Changelog") {
	const user = userEvent.setup();
	await user.click(await findRow("c1"));
	const trigger = await screen.findByRole("button", { name });
	await user.click(trigger);
	await screen.findByRole("complementary", { name });
	return { user, trigger };
}

describe("right rail drawer", () => {
	it("takes the focus as a drawer and gives it back on Escape", async () => {
		renderShop();
		narrowScreen();
		const { user, trigger } = await openPanel("Info");
		const close = screen.getByRole("button", { name: "Close panel" });
		await waitFor(() => expect(close).toHaveFocus());
		// Escape works from anywhere on the page while the drawer is open.
		close.blur();
		await user.keyboard("{Escape}");
		await waitFor(() => expect(byId("right-panel-info")).toBeNull());
		expect(trigger).toHaveFocus();
	});

	it("returns the focus to the rail when closed from inside the drawer", async () => {
		renderShop();
		narrowScreen();
		const { user, trigger } = await openPanel("Changelog");
		await user.click(screen.getByRole("button", { name: "Close panel" }));
		expect(byId("right-panel-changelog")).toBeNull();
		expect(trigger).toHaveFocus();
	});

	it("leaves the focus alone beside the page on wide screens", async () => {
		renderShop();
		const { user, trigger } = await openPanel("Info");
		expect(trigger).toHaveFocus();
		trigger.blur();
		await user.keyboard("{Escape}");
		expect(byId("right-panel-info")).not.toBeNull();
	});
});
