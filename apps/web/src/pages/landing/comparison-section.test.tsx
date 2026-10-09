import { FREE_LIMITS } from "@localman/shared/constants";
import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { COMPETITOR_FACTS } from "../../content/competitor-facts";
import { ComparisonSection } from "./comparison-section";
import { ALL_FEATURES, renderWithFeatures } from "./landing-test-helpers";

function rowKeys(container: HTMLElement): string[] {
	return [...container.querySelectorAll("tbody tr")].map(
		(row) =>
			row.getAttribute("data-id")?.replace("landing-compare-row-", "") ?? "",
	);
}

describe("ComparisonSection", () => {
	it("renders every released row from competitor-facts with Localman's Free limits", () => {
		const { container } = renderWithFeatures(<ComparisonSection />);
		const table = screen.getByRole("table", {
			name: "So sánh gói Free của Localman, mockapi.io và Postman",
		});
		const released = COMPETITOR_FACTS.rows.filter((row) => !row.requires);
		expect(rowKeys(container)).toEqual(released.map((row) => row.key));
		for (const row of released) {
			const tr = within(table).getByRole("row", {
				name: new RegExp(`^${row.label}`),
			});
			expect(tr).toHaveTextContent(row.localman(FREE_LIMITS));
			expect(tr).toHaveTextContent(row.mockapi.text);
			expect(tr).toHaveTextContent(row.postman.text);
		}
		expect(table).toHaveTextContent(
			`${FREE_LIMITS.projects} project, ${FREE_LIMITS.resources} resource mỗi project`,
		);
	});

	it("hides the localhost row until the API client is released, without a 'Sắp có'", () => {
		const off = renderWithFeatures(<ComparisonSection />);
		expect(rowKeys(off.container)).not.toContain("localhost");
		expect(off.container).not.toHaveTextContent("Sắp có");
		expect(off.container.textContent).not.toMatch(/localhost/i);
		off.unmount();

		const on = renderWithFeatures(<ComparisonSection />, ALL_FEATURES);
		expect(rowKeys(on.container)).toContain("localhost");
	});

	it("shows the update date and links every source", () => {
		const { container } = renderWithFeatures(<ComparisonSection />);
		const meta = container.querySelector('[data-id="landing-compare-meta"]');
		expect(COMPETITOR_FACTS.updatedAt).toBe("2026-10-08");
		expect(meta).toHaveTextContent("Cập nhật 08/10/2026");
		for (const source of COMPETITOR_FACTS.sources) {
			expect(
				screen.getByRole("link", { name: new RegExp(`^${source.label}`) }),
			).toHaveAttribute("href", source.url);
		}
		const ids = new Set(COMPETITOR_FACTS.sources.map((source) => source.id));
		for (const row of COMPETITOR_FACTS.rows) {
			expect(ids.has(row.mockapi.sourceId)).toBe(true);
			expect(ids.has(row.postman.sourceId)).toBe(true);
		}
	});

	it("footnotes every competitor value with the source it was read from", () => {
		const { container } = renderWithFeatures(<ComparisonSection />);
		const rows = COMPETITOR_FACTS.rows.filter((row) => !row.requires);
		const cells = container.querySelectorAll("tbody td");
		// Localman, mockapi.io, Postman per row; only the two competitors cite.
		expect(cells).toHaveLength(rows.length * 3);
		rows.forEach((row, index) => {
			[row.mockapi, row.postman].forEach((cell, offset) => {
				const td = cells[index * 3 + 1 + offset];
				const n =
					COMPETITOR_FACTS.sources.findIndex((s) => s.id === cell.sourceId) + 1;
				const note = td?.querySelector("sup a");
				expect(note).toHaveAttribute("href", `#compare-source-${n}`);
				const target = container.querySelector(`#compare-source-${n} a`);
				expect(target).toHaveAttribute(
					"href",
					COMPETITOR_FACTS.sources[n - 1]?.url,
				);
			});
			expect(cells[index * 3]?.querySelector("sup")).toBeNull();
		});
	});
});
