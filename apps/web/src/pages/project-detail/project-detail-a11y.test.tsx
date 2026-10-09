/**
 * axe-core and layout contract of the project page. jsdom has no layout,
 * so "no horizontal page scroll at 375px" is checked through the classes it
 * relies on (fluid grid track, scroll box around the canvas, breakable URL);
 * colour contrast is checked by `pnpm check:tokens` on the token pairs.
 */
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetCurrentUserCache } from "../../features/auth/use-current-user";
import { makeProject } from "../../test/fixtures";
import {
	PROJECT_ID,
	RESOURCES_PATH,
	bar,
	findNode,
	renderDetail,
	sampleTree,
} from "./project-detail-test-helpers";

async function seriousViolations(root: Element) {
	const result = await axe.run(root, {
		rules: { "color-contrast": { enabled: false } },
	});
	return result.violations
		.filter((v) => v.impact === "serious" || v.impact === "critical")
		.map(
			(v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
		);
}

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
		await userEvent.click(
			screen.getByRole("button", { name: "Thêm resource" }),
		);
		const dialog = await screen.findByRole("dialog", { name: "Resource mới" });
		expect(await seriousViolations(dialog)).toEqual([]);
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

	it("gives collaborators a read-only view", async () => {
		renderDetail(
			{ [`GET ${RESOURCES_PATH}`]: { body: { items: sampleTree() } } },
			makeProject(PROJECT_ID, { role: "collaborator" }),
		);
		const users = await findNode("users");
		expect(screen.queryByRole("button", { name: "Thêm resource" })).toBeNull();
		expect(screen.queryByRole("button", { name: "Thêm vào root" })).toBeNull();
		expect(within(users).queryByRole("button", { name: /^Chọn/ })).toBeNull();
		expect(
			within(users).queryByRole("button", { name: "Sửa users" }),
		).toBeNull();
		expect(
			within(users).getByRole("button", { name: "Dữ liệu users" }),
		).toBeInTheDocument();
		expect(bar(users)).toHaveAttribute("aria-disabled", "true");
		// No empty-project prompt or write for a read-only user.
		expect(screen.queryByRole("dialog")).toBeNull();
	});
});
