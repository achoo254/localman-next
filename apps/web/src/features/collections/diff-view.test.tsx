import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DiffView } from "./diff-view";

const list = (prefix: string, n: number) =>
	Array.from({ length: n }, (_, i) => `${prefix}${i}`);
const drawn = () => document.querySelectorAll("[data-diff]").length;

describe("DiffView", () => {
	it("folds unchanged lines away from a change, and unfolds them on request", async () => {
		const user = userEvent.setup();
		const before = { items: list("x", 20) };
		const after = {
			items: [...list("x", 10), "new", ...list("x", 20).slice(11)],
		};
		render(<DiffView before={before} after={after} label="Changes to Users" />);
		// "{", '"items": [' and x0..x9 surround the change; three stay on each side.
		const buttons = screen.getAllByRole("button", {
			name: /Show \d+ unchanged lines/,
		});
		expect(buttons.map((b) => b.textContent)).toEqual([
			"Show 9 unchanged lines",
			"Show 8 unchanged lines",
		]);
		expect(drawn()).toBe(8);
		const first = buttons[0];
		if (!first) throw new Error("no fold");
		await user.click(first);
		expect(drawn()).toBe(17);
		expect(
			screen.getByRole("region", { name: "Changes to Users" }),
		).toHaveFocus();
		expect(screen.getAllByRole("button")).toHaveLength(1);
	});

	it("draws 2000 lines at a time, even when the diff gives up on precision", async () => {
		const user = userEvent.setup();
		render(
			<DiffView
				before={{ items: list("a", 2101) }}
				after={{ items: list("b", 2101) }}
				label="Changes to Users"
			/>,
		);
		expect(drawn()).toBe(2000);
		expect(document.querySelectorAll('[data-diff="removed"]')).toHaveLength(
			1998,
		);
		await user.click(
			screen.getByRole("button", { name: "Show 2,206 more lines" }),
		);
		expect(drawn()).toBe(4000);
		await user.click(
			screen.getByRole("button", { name: "Show 206 more lines" }),
		);
		expect(drawn()).toBe(4206);
		expect(document.querySelectorAll('[data-diff="added"]')).toHaveLength(2101);
		expect(screen.queryByRole("button")).toBeNull();
	});

	it("says when nothing changed", () => {
		render(<DiffView before={{ a: 1 }} after={{ a: 1 }} label="x" />);
		expect(screen.getByText("Nothing changed in the content.")).toBeVisible();
	});
});
