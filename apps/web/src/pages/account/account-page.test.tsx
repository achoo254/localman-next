import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FeaturesContext, NO_FEATURES } from "../../config/features";
import { resetCurrentUserCache } from "../../features/auth/use-current-user";
import { makeUser } from "../../test/fixtures";
import { mockFetch } from "../../test/mock-fetch";
import { renderRoutes } from "../../test/render-app";
import { unreleasedMentions } from "../../test/unreleased-copy";
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
			name: "Mock requests this month",
		});
		expect(mock).toHaveAttribute("aria-valuenow", "8420");
		expect(mock).toHaveAttribute("aria-valuemax", "10000");
		expect(meter("account-meter-mock-requests")).toHaveAttribute(
			"data-state",
			"warning",
		);
		expect(meter("account-meter-mock-requests")).toHaveTextContent("84% used.");
		expect(meter("account-meter-mock-requests")).toHaveTextContent(
			"Resets on Jan 1, 2027.",
		);
		expect(meter("account-meter-projects")).toHaveAttribute("data-state", "ok");
		expect(meter("account-meter-projects")).toHaveTextContent("1/3");
	});

	it("hides the proxy meter and the MCP note until those features ship", async () => {
		renderAccount(usage());
		await screen.findByRole("meter", { name: "Mock requests this month" });
		expect(
			document.querySelector('[data-id="account-meter-proxy-requests"]'),
		).toBeNull();
		expect(meter("account-meter-mock-requests")).toHaveTextContent(
			"Counts every REST request to the mock. Resets on Jan 1, 2027.",
		);
		expect(unreleasedMentions(document.body)).toEqual([]);
	});

	it("shows the proxy meter and the MCP note once the flags are on", async () => {
		mockFetch({
			"GET /api/v1/users/me": { body: makeUser() },
			"GET /api/v1/account/usage": { body: usage() },
		});
		renderRoutes(
			[
				{
					path: "*",
					element: (
						<FeaturesContext
							value={{ ...NO_FEATURES, apiClient: true, mockMcp: true }}
						>
							<AccountPage />
						</FeaturesContext>
					),
				},
			],
			"/account",
		);
		expect(
			await screen.findByRole("meter", { name: "Proxy requests this month" }),
		).toHaveAttribute("aria-valuenow", "120");
		expect(meter("account-meter-mock-requests")).toHaveTextContent(
			"REST and MCP both count.",
		);
	});

	it("says when the quota is used up", async () => {
		renderAccount(usage({ projects: { used: 3, max: 3 } }));
		await screen.findByRole("meter", { name: "Projects" });
		expect(meter("account-meter-projects")).toHaveTextContent("Limit reached.");
	});

	it("shows 'Unlimited' instead of a bar for uncapped counters", async () => {
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
		expect(mock).toHaveTextContent("Unlimited");
		expect(mock).toHaveAttribute("data-state", "ok");
		// Asia/Saigon: 17:30Z on the 31st is already 1 January.
		expect(meter("account-limits-until")).toHaveTextContent(
			"Your extended limits last until Jan 1, 2027.",
		);
	});

	it("links to notification settings and names no plan or price", async () => {
		renderAccount(usage());
		expect(
			await screen.findByRole("link", { name: "Notification channels" }),
		).toHaveAttribute("href", "/account/notifications");
		expect(
			document.querySelector('[data-id="account-limits-until"]'),
		).toBeNull();
		expect(screen.queryByRole("button", { name: /plan|pro/i })).toBeNull();
		expect(document.body).not.toHaveTextContent(
			/\b(plan|pricing|upgrade|Pro)\b/i,
		);
	});

	it("ends with deleting the account, which runs the dry run first", async () => {
		renderAccount(usage());
		const open = await screen.findByRole("button", { name: "Delete account…" });
		expect(
			screen.getByRole("link", { name: "What is deleted" }),
		).toHaveAttribute("href", "/account/delete");
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				Response.json({
					ownedProjects: 0,
					sharedProjects: 0,
					projectMembers: 0,
					workspacesDeleted: 1,
					workspacesLeft: 0,
					collectionsDeleted: 0,
					blockedWorkspaces: [],
					dryRun: true,
					deleted: false,
				}),
			),
		);
		await userEvent.setup().click(open);
		expect(
			await screen.findByLabelText(/Type your username minhanh to confirm/),
		).toBeInTheDocument();
	});
});
