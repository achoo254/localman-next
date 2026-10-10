import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ALL_FEATURES } from "../../pages/landing/landing-test-helpers";
import {
	nodeCard,
	renderTree,
	sampleResources,
	tabIntoTree,
	treeItem,
} from "./tree-test-helpers";

/** Elements a Tab press can reach inside the tree. */
function tabStops(): Element[] {
	return [...screen.getByRole("tree").querySelectorAll('[tabindex="0"]')];
}

describe("resource tree keyboard (roving tabindex)", () => {
	it("is a tree of positioned items with one tab stop", () => {
		renderTree();
		expect(screen.getByRole("tree", { name: "Resource tree" })).toBeVisible();
		const users = treeItem("users");
		expect(users).toHaveAttribute("aria-level", "1");
		expect(users).toHaveAttribute("aria-setsize", "2");
		expect(users).toHaveAttribute("aria-posinset", "1");
		expect(users).toHaveAttribute("aria-expanded", "true");
		const comments = treeItem("comments");
		expect(comments).toHaveAttribute("aria-level", "3");
		expect(comments).not.toHaveAttribute("aria-expanded");
		expect(treeItem("likes")).toHaveAttribute("aria-posinset", "2");
		expect(tabStops()).toEqual([users]);
	});

	it("moves with the arrows, Home and End in tree order", async () => {
		renderTree();
		await tabIntoTree();
		expect(treeItem("users")).toHaveFocus();
		await userEvent.keyboard("{ArrowDown}");
		expect(treeItem("posts")).toHaveFocus();
		await userEvent.keyboard("{ArrowRight}");
		expect(treeItem("comments")).toHaveFocus();
		await userEvent.keyboard("{ArrowLeft}");
		expect(treeItem("posts")).toHaveFocus();
		await userEvent.keyboard("{End}");
		expect(treeItem("likes")).toHaveFocus();
		await userEvent.keyboard("{ArrowUp}");
		expect(treeItem("comments")).toHaveFocus();
		await userEvent.keyboard("{Home}");
		expect(treeItem("users")).toHaveFocus();
		// The tab stop follows the focus.
		await userEvent.keyboard("{ArrowDown}");
		expect(treeItem("posts")).toHaveAttribute("tabindex", "0");
		expect(treeItem("users")).toHaveAttribute("tabindex", "-1");
	});

	it("opens Data with Enter", async () => {
		const { onAction } = renderTree();
		await tabIntoTree();
		await userEvent.keyboard("{ArrowDown}{Enter}");
		expect(onAction).toHaveBeenCalledWith(
			"data",
			expect.objectContaining({ id: "posts" }),
		);
	});

	it("lets Tab step into the focused node's controls, then out of the tree", async () => {
		renderTree(sampleResources(), ALL_FEATURES);
		await tabIntoTree();
		const users = treeItem("users");
		const card = nodeCard("users");
		expect(users).toHaveFocus();
		await userEvent.tab();
		expect(
			within(card).getByRole("button", { name: "Select users to move" }),
		).toHaveFocus();
		await userEvent.tab();
		expect(within(card).getByRole("link", { name: "users" })).toHaveFocus();
		// Keys typed in the slider stay the slider's.
		await userEvent.tab();
		const slider = within(card).getByRole("slider");
		expect(slider).toHaveFocus();
		await userEvent.keyboard("{ArrowDown}");
		expect(slider).toHaveFocus();
		await userEvent.tab({ shift: true });
		await userEvent.tab({ shift: true });
		await userEvent.tab({ shift: true });
		expect(users).toHaveFocus();
		// Other nodes' controls are not in the tab order.
		expect(
			within(nodeCard("posts")).getByRole("button", { name: "Edit posts" }),
		).toHaveAttribute("tabindex", "-1");
	});

	it("scrolls the focused node into view", async () => {
		const calls: string[] = [];
		const original = Element.prototype.scrollIntoView;
		Element.prototype.scrollIntoView = function (this: Element) {
			calls.push(this.getAttribute("aria-label") ?? "");
		};
		try {
			renderTree();
			await tabIntoTree();
			await userEvent.keyboard("{End}");
			expect(calls).toEqual(["likes"]);
		} finally {
			Element.prototype.scrollIntoView = original;
		}
	});
});
