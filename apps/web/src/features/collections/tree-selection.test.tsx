import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	LIST_PATH,
	ORDERS,
	byId,
	findRow,
	renderWorkbenchPage,
	row,
	summary,
} from "./collections-test-utils";

afterEach(() => vi.unstubAllGlobals());

function renderShop(misc: "editor" | "viewer" = "editor") {
	return renderWorkbenchPage({
		[`GET ${LIST_PATH}`]: {
			body: {
				items: [
					summary("c1", { name: "Orders", requestCount: 2 }),
					summary("c2", { name: "Misc", role: misc }),
				],
			},
		},
		"GET /api/v1/collections/c1": { body: ORDERS },
	});
}

const pickedCount = () => byId("sidebar-bulk-bar")?.textContent ?? "";

describe("tree multi-select", () => {
	it("leaves rows the caller cannot delete out of a range", async () => {
		renderShop("viewer");
		const user = userEvent.setup();
		await user.keyboard("{Control>}");
		await user.click(await findRow("c1"));
		await user.keyboard("{/Control}{Shift>}");
		await user.click(await findRow("c2"));
		await user.keyboard("{/Shift}");
		expect(pickedCount()).toContain("1 selected");
		expect(row("c2")).toHaveAttribute("aria-selected", "false");
		expect(row("c1")).toHaveAttribute("aria-selected", "true");
		// Ctrl-click on a row one may only read does nothing either.
		await user.keyboard("{Control>}");
		await user.click(await findRow("c2"));
		await user.keyboard("{/Control}");
		expect(pickedCount()).toContain("1 selected");
	});

	it("picks with Ctrl+Space and Shift+arrows from the keyboard", async () => {
		renderShop();
		const user = userEvent.setup();
		await user.click(await findRow("c1"));
		await user.click(await findRow("f1"));
		expect(screen.getByRole("tree")).toHaveAttribute(
			"aria-multiselectable",
			"true",
		);
		(await findRow("r1")).focus();
		await user.keyboard("{Control>} {/Control}");
		expect(pickedCount()).toContain("1 selected");
		await user.keyboard("{Shift>}{ArrowDown}{/Shift}");
		expect(pickedCount()).toContain("2 selected");
		expect(row("r2")).toHaveFocus();
		expect(row("r2")).toHaveAttribute("aria-selected", "true");
		await user.keyboard("{Control>} {/Control}");
		expect(pickedCount()).toContain("1 selected");
		await user.keyboard("{Escape}");
		expect(byId("sidebar-bulk-bar")).toBeNull();
	});

	it("marks the row of the open tab as current", async () => {
		renderShop();
		const user = userEvent.setup();
		await user.click(await findRow("c1"));
		await user.click(await findRow("r2"));
		await waitFor(() =>
			expect(row("r2")).toHaveAttribute("aria-current", "page"),
		);
		expect(row("c1")).not.toHaveAttribute("aria-current");
	});
});
