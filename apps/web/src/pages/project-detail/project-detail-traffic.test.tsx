import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FeaturesContext, NO_FEATURES } from "../../config/features";
import { resetCurrentUserCache } from "../../features/auth/use-current-user";
import {
	FakeEventSource,
	stubEventSource,
} from "../../features/request-log/fake-event-source";
import { settingsJson } from "../../features/request-log/request-log-test-utils";
import { seriousViolations } from "../../test/axe";
import { makeProject } from "../../test/fixtures";
import { mockFetch } from "../../test/mock-fetch";
import { renderRoutes } from "../../test/render-app";
import { unreleasedMentions } from "../../test/unreleased-copy";
import { ApiEndpointCard } from "./api-endpoint-card";
import {
	PROJECT_ID,
	RESOURCES_PATH,
	renderDetail,
} from "./project-detail-test-helpers";

const HYBRID = { ...NO_FEATURES, hybridMock: true };
const LOGS = `/api/v1/projects/${PROJECT_ID}/request-logs`;
const ROUTES = {
	[`GET ${RESOURCES_PATH}`]: { body: { items: [] } },
	[`GET /api/v1/projects/${PROJECT_ID}/traffic-settings`]: {
		body: settingsJson(),
	},
	[`GET ${LOGS}`]: { body: { items: [], nextCursor: null } },
	[`GET /api/v1/projects/${PROJECT_ID}/inboxes`]: {
		body: { items: [], used: 0, max: 2, canManage: true },
	},
};

const tabNames = () =>
	screen.getAllByRole("tab").map((tab) => tab.textContent ?? "");

describe("traffic tabs of the endpoint card", () => {
	beforeEach(() => {
		resetCurrentUserCache();
		stubEventSource();
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
	});
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("shows nothing about the hybrid mock while its flag is off", async () => {
		renderDetail(ROUTES, undefined, {
			flags: { ...NO_FEATURES, mockMcp: true },
			path: `/projects/${PROJECT_ID}?endpoint=log`,
		});
		const rest = await screen.findByRole("tab", { name: "REST" });
		expect(rest).toHaveAttribute("aria-selected", "true");
		expect(tabNames()).toEqual(["REST", "MCP"]);
		expect(FakeEventSource.instances).toHaveLength(0);
		expect(document.body).not.toHaveTextContent(/Upstream|Request log/);
	});

	it("has no unreleased copy with every flag off", async () => {
		renderDetail(ROUTES);
		await screen.findByText("API endpoint");
		expect(unreleasedMentions(document.body)).toEqual([]);
		expect(screen.queryByRole("tablist")).toBeNull();
	});

	it("adds Upstream and Request log, kept in ?endpoint=", async () => {
		const { router } = renderDetail(ROUTES, undefined, { flags: HYBRID });
		await screen.findByRole("tab", { name: "REST" });
		expect(tabNames()).toEqual(["REST", "Upstream", "Request log", "Inbox"]);
		await userEvent.click(screen.getByRole("tab", { name: "Upstream" }));
		expect(router.state.location.search).toBe("?endpoint=upstream");
		const upstream = screen.getByRole("tabpanel");
		expect(upstream).toHaveAttribute("data-id", "project-detail-upstream");
		expect(
			await within(upstream).findByText(
				"Upstream for routes the mock doesn't have",
			),
		).toBeVisible();
		expect(FakeEventSource.instances).toHaveLength(0);
		await userEvent.click(screen.getByRole("tab", { name: "Request log" }));
		expect(router.state.location.search).toBe("?endpoint=log");
		expect(await screen.findByText(/No requests yet/)).toBeVisible();
		expect(FakeEventSource.open()).toHaveLength(1);
		// Leaving the tab closes the live stream.
		await userEvent.click(screen.getByRole("tab", { name: "REST" }));
		expect(FakeEventSource.open()).toHaveLength(0);
		expect(await seriousViolations(document.body)).toEqual([]);
	});

	it("shows the project's webhook inboxes in the Inbox tab", async () => {
		const { router } = renderDetail(ROUTES, undefined, { flags: HYBRID });
		await userEvent.click(await screen.findByRole("tab", { name: "Inbox" }));
		expect(router.state.location.search).toBe("?endpoint=inbox");
		expect(await screen.findByText("No inboxes yet")).toBeVisible();
	});

	it("opens the log already filtered from the address, then drops the filter", async () => {
		const { calls, router } = renderDetail(ROUTES, undefined, {
			flags: HYBRID,
			path: `/projects/${PROJECT_ID}?endpoint=log&logSource=inbox&logPath=%2F_inbox%2Fstripe`,
		});
		expect(await screen.findByLabelText("Source")).toHaveValue("inbox");
		expect(screen.getByLabelText("Path contains")).toHaveValue(
			"/_inbox/stripe",
		);
		const list = calls.find((call) => call.path === LOGS);
		expect(list?.query.toString()).toBe("source=inbox&path=%2F_inbox%2Fstripe");
		expect(router.state.location.search).toBe("?endpoint=log");
	});

	it("gives the Inbox tab to whoever passes its content", async () => {
		mockFetch({});
		renderRoutes(
			[
				{
					path: "/",
					element: (
						<FeaturesContext value={HYBRID}>
							<ApiEndpointCard
								project={makeProject(PROJECT_ID)}
								resources={[]}
								busy={false}
								onNewResource={() => {}}
								onImport={() => {}}
								onGenerateAll={() => {}}
								onResetAll={() => {}}
								inbox={<p>Inbox content</p>}
							/>
						</FeaturesContext>
					),
				},
			],
			"/?endpoint=inbox",
		);
		const tab = await screen.findByRole("tab", { name: "Inbox" });
		expect(tab).toHaveAttribute("aria-selected", "true");
		expect(tab).toHaveAttribute("data-id", "project-detail-endpoint-tab-inbox");
		expect(screen.getByRole("tabpanel")).toHaveTextContent("Inbox content");
	});
});
