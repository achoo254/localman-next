import { limitsFor } from "@localman/shared/constants";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NO_FEATURES } from "../../config/features";
import { planItems } from "../../features/subscription/plan-card";
import { formatNumber } from "../../lib/format";
import {
	ALL_FEATURES,
	itemsOf,
	renderWithFeatures,
} from "./landing-test-helpers";
import { PricingTable } from "./pricing-table";

function renderTable(flags = NO_FEATURES) {
	const onContactPro = vi.fn();
	const view = renderWithFeatures(
		<PricingTable onContactPro={onContactPro} />,
		flags,
	);
	return { ...view, onContactPro };
}

describe("PricingTable", () => {
	it("lists Free and Pro from plan-limits without the proxy while the API client is off", () => {
		const { container } = renderTable();
		expect(itemsOf(container, "pricing-card-free")).toMatchInlineSnapshot(`
			[
			  "3 project",
			  "10 resource mỗi project",
			  "Custom response và object template",
			  "Tối đa 3 thành viên mỗi project, tính cả bạn",
			  "10.000 request tới mock mỗi tháng",
			]
		`);
		expect(itemsOf(container, "pricing-card-pro")).toMatchInlineSnapshot(`
			[
			  "20 project",
			  "50 resource mỗi project",
			  "Custom response và object template",
			  "Tối đa 10 thành viên mỗi project, tính cả bạn",
			  "Không giới hạn request tới mock mỗi tháng",
			]
		`);
		const free = limitsFor("free");
		expect(itemsOf(container, "pricing-card-free")).toContain(
			`${formatNumber(free.mockRequestsPerMonth ?? 0)} request tới mock mỗi tháng`,
		);
		expect(container.textContent).not.toMatch(/proxy/i);
	});

	it("adds the proxy quota once the API client is released", () => {
		const { container } = renderTable(ALL_FEATURES);
		expect(itemsOf(container, "pricing-card-free")).toMatchInlineSnapshot(`
			[
			  "3 project",
			  "10 resource mỗi project",
			  "Custom response và object template",
			  "Tối đa 3 thành viên mỗi project, tính cả bạn",
			  "10.000 request tới mock mỗi tháng",
			  "5.000 request qua proxy mỗi tháng",
			]
		`);
		expect(itemsOf(container, "pricing-card-pro")).toMatchInlineSnapshot(`
			[
			  "20 project",
			  "50 resource mỗi project",
			  "Custom response và object template",
			  "Tối đa 10 thành viên mỗi project, tính cả bạn",
			  "Không giới hạn request tới mock mỗi tháng",
			  "Không giới hạn request qua proxy mỗi tháng",
			]
		`);
	});

	it("renders exactly the items planItems derives from limitsFor", () => {
		for (const flags of [NO_FEATURES, ALL_FEATURES]) {
			const { container, unmount } = renderTable(flags);
			for (const plan of ["free", "pro"] as const) {
				expect(itemsOf(container, `pricing-card-${plan}`)).toEqual(
					planItems(limitsFor(plan), flags).map(([, label]) => label),
				);
			}
			unmount();
		}
	});

	it("shows a price for Free only and a contact button for Pro", async () => {
		const { container, onContactPro } = renderTable();
		expect(
			container.querySelector('[data-id="pricing-card-free-price"]'),
		).toHaveTextContent("Free");
		const pro = container.querySelector('[data-id="pricing-card-pro"]');
		expect(pro?.textContent).not.toMatch(/₫|đ\/|\$|chưa chốt|not decided/i);
		expect(pro).toHaveTextContent("Interest list open");
		await userEvent.click(screen.getByRole("button", { name: "Contact" }));
		expect(onContactPro).toHaveBeenCalledTimes(1);
	});
});
