import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	type FeatureFlags,
	FeaturesContext,
	NO_FEATURES,
} from "../../config/features";
import { ALL_FEATURES } from "../../pages/landing/landing-test-helpers";
import { makeUser } from "../../test/fixtures";
import { renderRoutes } from "../../test/render-app";
import { AccountMenu } from "./account-menu";

const APPS_NAME =
	/^Ứng dụng đã cấp quyền ?, mở trang tài khoản hoandat ở tab mới$/;

async function openMenu(flags: FeatureFlags) {
	renderRoutes(
		[
			{
				path: "*",
				element: (
					<FeaturesContext value={flags}>
						<AccountMenu
							user={makeUser()}
							logoutBusy={false}
							onLogout={() => undefined}
							onManagePlan={() => undefined}
						/>
					</FeaturesContext>
				),
			},
		],
		"/projects",
	);
	screen.getByRole("button", { name: "Tài khoản Minh Anh" }).focus();
	await userEvent.keyboard("{Enter}");
	await screen.findByRole("menu");
}

describe("account menu entry 'Ứng dụng đã cấp quyền'", () => {
	afterEach(() => vi.restoreAllMocks());

	it("is hidden while Mock MCP is unreleased", async () => {
		await openMenu(NO_FEATURES);
		expect(screen.queryByRole("menuitem", { name: APPS_NAME })).toBeNull();
	});

	it("opens the IdP list of authorised apps in a new tab", async () => {
		const open = vi.spyOn(window, "open").mockReturnValue(null);
		await openMenu(ALL_FEATURES);
		const item = screen.getByRole("menuitem", { name: APPS_NAME });
		expect(item).toHaveAttribute("data-id", "account-menu-apps");
		await userEvent.click(item);
		expect(open).toHaveBeenCalledWith(
			"https://auth.hoandat.com/account#account-apps",
			"_blank",
			"noopener,noreferrer",
		);
	});
});
