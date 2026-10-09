import { PRO_INTEREST_SOURCES } from "@localman/shared";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetCurrentUserCache } from "../../features/auth/use-current-user";
import { downloadText } from "../../platform/download";
import { renderAdmin } from "./pro-interest-test-helpers";

vi.mock("../../platform/download", () => ({ downloadText: vi.fn() }));

describe("ProInterestPage list details", () => {
	beforeEach(() => resetCurrentUserCache());
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.mocked(downloadText).mockClear();
	});

	it("expands the submission history of a row", async () => {
		renderAdmin(true, {});
		const toggle = await screen.findByRole("button", { name: "Lịch sử (2)" });
		expect(toggle).toHaveAttribute("aria-expanded", "false");
		expect(screen.getAllByText("Email khớp tài khoản")).toHaveLength(1);
		await userEvent.click(toggle);
		expect(toggle).toHaveAttribute("aria-expanded", "true");
		const history = document.querySelector(
			'[data-id="admin-pro-row-a1-history"]',
		);
		if (!(history instanceof HTMLElement)) throw new Error("no history");
		const entries = within(history).getAllByRole("listitem");
		expect(entries).toHaveLength(2);
		expect(entries[0]).toHaveTextContent("Giới hạn project");
		expect(entries[0]).toHaveTextContent("100.000–250.000đ mỗi tháng");
		expect(entries[1]).toHaveTextContent("Chưa xác minh");
		expect(entries[1]).toHaveTextContent("Không áp dụng");
	});

	it("offers only whitelisted sources in the filter", async () => {
		renderAdmin(true, {});
		await screen.findByText("a1***@example.com");
		const options = within(
			screen.getByRole("combobox", { name: "Nguồn" }),
		).getAllByRole("option");
		expect(options.map((option) => option.getAttribute("value"))).toEqual([
			"",
			...PRO_INTEREST_SOURCES,
		]);
	});

	it("scrolls the wide table inside a positioned box at 375px", async () => {
		renderAdmin(true, {});
		await screen.findByText("a1***@example.com");
		const scroller = document.querySelector(
			'[data-id="admin-pro-table-scroll"]',
		);
		// `relative` keeps the sr-only caption inside the scroll box, so it
		// cannot widen the page.
		expect(scroller).toHaveClass("relative", "overflow-x-auto");
		expect(scroller?.contains(screen.getByText(/email đã che một phần/))).toBe(
			true,
		);
	});
});
