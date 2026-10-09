import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetCurrentUserCache } from "../../features/auth/use-current-user";
import { makeUser } from "../../test/fixtures";
import { mockFetch } from "../../test/mock-fetch";
import { expectProInterestSource } from "../../test/pro-interest";
import { renderRoutes } from "../../test/render-app";
import { AccountPage } from "./account-page";

function usage(overrides: Record<string, unknown> = {}) {
	return {
		plan: "free",
		planExpiresAt: null,
		period: "2026-12",
		projects: { used: 1, max: 3 },
		mockRequests: { used: 8_420, max: 10_000 },
		proxyRequests: { used: 120, max: 5_000 },
		...overrides,
	};
}

function renderAccount(body: unknown) {
	mockFetch({
		"GET /api/v1/users/me": { body: makeUser() },
		"GET /api/v1/account/usage": { body },
	});
	renderRoutes([{ path: "*", element: <AccountPage /> }], "/account");
}

const meter = (dataId: string) => {
	const element = document.querySelector(`[data-id="${dataId}"]`);
	if (!(element instanceof HTMLElement)) throw new Error(`no ${dataId}`);
	return element;
};

describe("AccountPage quota meters", () => {
	beforeEach(() => resetCurrentUserCache());
	afterEach(() => vi.unstubAllGlobals());

	it("turns a meter to warning from 80% and explains it", async () => {
		renderAccount(usage());
		const mock = await screen.findByRole("meter", {
			name: "Request tới mock tháng này",
		});
		expect(mock).toHaveAttribute("aria-valuenow", "8420");
		expect(mock).toHaveAttribute("aria-valuemax", "10000");
		expect(meter("account-meter-mock-requests")).toHaveAttribute(
			"data-state",
			"warning",
		);
		expect(meter("account-meter-mock-requests")).toHaveTextContent(
			"Đã dùng 84%.",
		);
		expect(meter("account-meter-mock-requests")).toHaveTextContent(
			"Đặt lại ngày 01/01/2027.",
		);
		expect(meter("account-meter-projects")).toHaveAttribute("data-state", "ok");
		expect(meter("account-meter-projects")).toHaveTextContent("1/3");
	});

	it("says when the quota is used up", async () => {
		renderAccount(usage({ projects: { used: 3, max: 3 } }));
		await screen.findByRole("meter", { name: "Projects" });
		expect(meter("account-meter-projects")).toHaveTextContent(
			"Đã đạt hạn mức.",
		);
	});

	it("shows 'Không giới hạn' instead of a bar for uncapped counters", async () => {
		renderAccount(
			usage({
				plan: "pro",
				planExpiresAt: "2026-12-31T17:30:00.000Z",
				projects: { used: 4, max: 20 },
				mockRequests: { used: 52_000, max: null },
				proxyRequests: { used: 0, max: null },
			}),
		);
		await screen.findByRole("meter", { name: "Projects" });
		expect(screen.getAllByRole("meter")).toHaveLength(1);
		const mock = meter("account-meter-mock-requests");
		expect(mock).toHaveTextContent("Không giới hạn");
		expect(mock).toHaveAttribute("data-state", "ok");
		// Asia/Saigon: 17:30Z on the 31st is already 1 January.
		expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
			"Gói Pro · hết hạn 01/01/2027",
		);
	});

	it("links to notification settings and opens the plans modal", async () => {
		renderAccount(usage());
		expect(
			await screen.findByRole("link", { name: "Cài đặt thông báo" }),
		).toHaveAttribute("href", "/account/notifications");
		await userEvent.click(screen.getByRole("button", { name: "Quản lý gói" }));
		const dialog = screen.getByRole("dialog", { name: "Quản lý gói" });
		expect(within(dialog).queryByRole("alert")).toBeNull();
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Liên hệ nâng cấp" }),
		);
		await expectProInterestSource("account");
	});
});
