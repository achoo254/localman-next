/**
 * jsdom has no layout engine, so the 375px / 1440px comparison with the
 * prototype is checked through the responsive class contract each screen
 * relies on (Tailwind: `sm` = 640px, `md` = 768px). Visual comparison
 * against `prototype/index.html` is done in a browser at both widths.
 */
import { limitsFor } from "@localman/shared";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ManageSubscriptionModal } from "../../features/subscription/manage-subscription-modal";
import { UsageMeter } from "../../features/subscription/usage-meter";
import { makeProject } from "../../test/fixtures";
import { ProjectRow } from "./project-row";

describe("layout at 375px and 1440px", () => {
	it("project rows truncate long names and URLs instead of overflowing", () => {
		render(
			<ul>
				<ProjectRow
					project={makeProject("p1", {
						name: "Một tên project rất dài để thử cắt chữ ở màn hẹp",
					})}
					onAction={vi.fn()}
				/>
			</ul>,
		);
		const name = screen.getByText(/Một tên project rất dài/);
		expect(name).toHaveClass("truncate");
		expect(name.closest(".min-w-0")).not.toBeNull();
		expect(screen.getByText(/mock\.localman\.test/)).toHaveClass("truncate");
	});

	it("plan cards stack on phones and sit side by side from 640px", () => {
		render(
			<ManageSubscriptionModal
				open
				onOpenChange={vi.fn()}
				plan="free"
				reason="projects"
				onContact={vi.fn()}
			/>,
		);
		const plans = document.querySelector(
			'[data-id="modal-subscription-plans"]',
		);
		expect(plans).toHaveClass("grid", "sm:grid-cols-2");
		expect(plans).not.toHaveClass("grid-cols-2");
		expect(plans).toHaveTextContent(`${limitsFor("pro").projects} project`);
	});

	it("quota meters keep the bar full-width inside a fluid card", () => {
		render(
			<UsageMeter
				data-id="meter"
				label="Projects"
				counter={{ used: 1, max: 3 }}
				note=""
			/>,
		);
		const head = screen.getByText("Projects").parentElement;
		expect(head).toHaveClass("flex-wrap");
		expect(screen.getByRole("meter")).not.toHaveAttribute("style");
	});
});
