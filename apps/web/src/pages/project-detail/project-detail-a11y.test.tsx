/**
 * axe-core and layout contract of the project page. jsdom has no layout,
 * so "no horizontal page scroll at 375px" is checked through the classes it
 * relies on (fluid grid track, scroll box around the canvas, breakable URL);
 * colour contrast is checked by `pnpm check:tokens` on the token pairs.
 */
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetCurrentUserCache } from "../../features/auth/use-current-user";
import { seriousViolations } from "../../test/axe";
import { makeProject } from "../../test/fixtures";
import { ALL_FEATURES } from "../landing/landing-test-helpers";
import {
	PROJECT_ID,
	RESOURCES_PATH,
	bar,
	findNode,
	renderDetail,
	sampleTree,
} from "./project-detail-test-helpers";

describe("project page accessibility and layout", () => {
	beforeEach(() => {
		resetCurrentUserCache();
		// axe probes fonts through a canvas, which jsdom does not implement.
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
	});
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("has no serious axe violations on the tree or in the resource form", async () => {
		const { container } = renderDetail({
			[`GET ${RESOURCES_PATH}`]: { body: { items: sampleTree() } },
		});
		await findNode("comments");
		expect(await seriousViolations(container)).toEqual([]);
		await userEvent.click(screen.getByRole("button", { name: "Add resource" }));
		const dialog = await screen.findByRole("dialog", { name: "New resource" });
		expect(await seriousViolations(dialog)).toEqual([]);
	});

	it("keeps the power-ups free of serious axe violations", async () => {
		const { container } = renderDetail(
			{ [`GET ${RESOURCES_PATH}`]: { body: { items: [] } } },
			undefined,
			{ flags: ALL_FEATURES },
		);
		// Empty project: the empty state offers Import next to Add resource.
		await userEvent.click(
			await screen.findByRole("button", { name: "Import" }),
		);
		const dialog = await screen.findByRole("dialog", {
			name: "Import resource",
		});
		expect(await seriousViolations(dialog)).toEqual([]);
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Cancel" }),
		);
		expect(await seriousViolations(container)).toEqual([]);
		const [add] = screen.getAllByRole("button", { name: "Add resource" });
		if (!add) throw new Error("no Add resource button");
		await userEvent.click(add);
		const form = await screen.findByRole("dialog", { name: "New resource" });
		await userEvent.click(
			within(form).getByRole("button", { name: "Rules for GET /resource" }),
		);
		await userEvent.click(
			within(form).getByRole("button", { name: "Add rule" }),
		);
		await userEvent.click(
			within(form).getByRole("button", { name: "Chaos for POST /resource" }),
		);
		expect(await seriousViolations(form)).toEqual([]);
	});

	it("scrolls wide trees inside the card, never the page", async () => {
		renderDetail({
			[`GET ${RESOURCES_PATH}`]: { body: { items: sampleTree() } },
		});
		const node = await findNode("comments");
		const page = document.querySelector('[data-id="project-detail"]');
		expect(page).toHaveClass("grid", "grid-cols-[minmax(0,1fr)]");
		const canvas = node.parentElement;
		expect(canvas?.parentElement).toHaveClass("overflow-x-auto");
		expect(document.querySelector('[data-id="resource-tree"]')).toHaveClass(
			"min-w-0",
		);
		expect(
			document.querySelector('[data-id="project-detail-endpoint-url"]'),
		).toHaveClass("wrap-anywhere");
		for (const id of ["project-detail-endpoint", "project-detail-tree"]) {
			expect(document.querySelector(`[data-id="${id}"]`)).toHaveClass(
				"min-w-0",
				"overflow-hidden",
			);
		}
	});

	it("lets collaborators edit resources, not the project's mock URL", async () => {
		renderDetail(
			{ [`GET ${RESOURCES_PATH}`]: { body: { items: sampleTree() } } },
			makeProject(PROJECT_ID, { role: "collaborator" }),
		);
		const users = await findNode("users");
		expect(
			screen.getByRole("button", { name: "Add resource" }),
		).toBeInTheDocument();
		expect(
			within(users).getByRole("button", { name: "Edit users" }),
		).toBeInTheDocument();
		expect(bar(users)).not.toHaveAttribute("aria-disabled", "true");
		expect(
			screen.queryByRole("button", { name: "Change mock URL" }),
		).toBeNull();
	});
});
