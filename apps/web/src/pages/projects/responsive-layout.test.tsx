/**
 * jsdom has no layout engine, so the 375px / 1440px comparison with the
 * prototype is checked through the responsive class contract each screen
 * relies on (Tailwind: `sm` = 640px, `md` = 768px). Visual comparison
 * against `prototype/index.html` is done in a browser at both widths.
 */
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { UsageMeter } from "../../features/subscription/usage-meter";
import { makeProject } from "../../test/fixtures";
import { ProjectRow } from "./project-row";

describe("layout at 375px and 1440px", () => {
	it("project rows keep long names to two lines and truncate URLs", () => {
		render(
			<MemoryRouter>
				<ul>
					<ProjectRow
						project={makeProject("p1", {
							name: "Một tên project rất dài để thử cắt chữ ở màn hẹp",
						})}
						onAction={vi.fn()}
					/>
				</ul>
			</MemoryRouter>,
		);
		const name = screen.getByText(/Một tên project rất dài/);
		expect(name).toHaveClass("line-clamp-2", "wrap-anywhere");
		expect(name).toHaveAttribute("title", name.textContent);
		expect(name.closest(".min-w-0")).not.toBeNull();
		expect(screen.getByText(/mock\.localman\.test/)).toHaveClass("truncate");
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
