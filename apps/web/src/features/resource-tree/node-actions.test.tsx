import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NO_FEATURES } from "../../config/features";
import { seriousViolations } from "../../test/axe";
import {
	nodeCard,
	openNodeMenu,
	renderTree,
	resource,
	sampleResources,
} from "./tree-test-helpers";

describe("node actions", () => {
	beforeEach(() => {
		// axe probes fonts through a canvas, which jsdom lacks.
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
	});
	afterEach(() => vi.restoreAllMocks());

	it("shows only Edit, Data and ⋯ on the card", () => {
		renderTree();
		const buttons = within(nodeCard("users"))
			.getAllByRole("button")
			.map((button) => button.getAttribute("aria-label"));
		expect(buttons).toEqual([
			"Select users to move",
			"Edit users",
			"Data of users",
			"More actions for users",
			"Nest the selected resource into users",
		]);
	});

	it("lists API Client, Export types and, last and set apart, Delete", async () => {
		renderTree();
		const menu = await openNodeMenu("users");
		expect(
			within(menu)
				.getAllByRole("menuitem")
				.map((item) => item.textContent),
		).toEqual([
			"API Client",
			"Copy TypeScript",
			"Download users.ts",
			"Copy Zod schema",
			"Download users.schema.ts",
			"Delete",
		]);
		for (const id of ["client", "types", "delete"]) {
			expect(
				menu.querySelector(`[data-id="resource-node-users-${id}"]`),
			).not.toBeNull();
		}
		const last = menu.lastElementChild;
		expect(last).toHaveAttribute("data-id", "resource-node-users-delete");
		expect(last).toHaveClass("text-error");
		expect(last?.previousElementSibling).toHaveAttribute("role", "separator");
	});

	it("hands each entry to the page; Delete asks the page to confirm", async () => {
		const { onAction, onOpenInClient } = renderTree();
		await userEvent.click(
			within(await openNodeMenu("posts")).getByRole("menuitem", {
				name: "Open posts in API Client",
			}),
		);
		expect(onOpenInClient).toHaveBeenCalledWith(
			expect.objectContaining({ id: "posts" }),
		);
		await userEvent.click(
			within(await openNodeMenu("posts")).getByRole("menuitem", {
				name: "Delete posts",
			}),
		);
		// The page opens its confirmation dialog for "delete"; nothing is removed here.
		expect(onAction).toHaveBeenCalledWith(
			"delete",
			expect.objectContaining({ id: "posts" }),
		);
		expect(screen.queryByRole("menu")).toBeNull();
	});

	it("leaves Export types out without the mock power-ups", async () => {
		renderTree(sampleResources(), NO_FEATURES);
		const menu = await openNodeMenu("users");
		expect(
			within(menu)
				.getAllByRole("menuitem")
				.map((item) => item.textContent),
		).toEqual(["API Client", "Delete"]);
		expect(within(menu).getAllByRole("separator")).toHaveLength(1);
		expect(
			menu.querySelector('[data-id="resource-node-users-types"]'),
		).toBeNull();
	});

	it("cuts a long name in the middle and keeps the full name", () => {
		const name = "customer-relationship-management-contacts-name-01";
		renderTree([resource("crm", { name })]);
		const link = within(nodeCard(name)).getByRole("link", { name });
		const [head, tail] = [...link.children];
		expect(head).toHaveClass("truncate");
		expect(tail).toHaveTextContent(/^-name-01$/);
		expect(link.getAttribute("title")?.split("\n")[0]).toBe(name);
	});

	it("has no serious axe violations, menu closed or open", async () => {
		const { container } = renderTree();
		expect(await seriousViolations(container)).toEqual([]);
		const menu = await openNodeMenu("users");
		expect(await seriousViolations(menu)).toEqual([]);
	});
});
