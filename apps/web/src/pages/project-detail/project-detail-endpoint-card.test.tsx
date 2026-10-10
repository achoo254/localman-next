import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetCurrentUserCache } from "../../features/auth/use-current-user";
import { makeProject } from "../../test/fixtures";
import { ALL_FEATURES } from "../landing/landing-test-helpers";
import {
	PROJECT_ID,
	RESOURCES_PATH,
	held,
	renderDetail,
	sampleTree,
} from "./project-detail-test-helpers";

const TOKEN = {
	[`GET /api/v1/projects/${PROJECT_ID}/mcp-token`]: {
		body: { required: false, token: null },
	},
};
const TREE = { body: { items: sampleTree() } };
const byId = (id: string) => document.querySelector(`[data-id="${id}"]`);
const LONG_NAME =
	"UI test - Tên dự án tiếng Việt rất dài để kiểm tra bố cục 中文项目";

function renderTabs(routes = {}, path = "") {
	return renderDetail(
		{ [`GET ${RESOURCES_PATH}`]: TREE, ...TOKEN, ...routes },
		makeProject(PROJECT_ID, {
			name: LONG_NAME,
			prefix: "/very/long/prefix/for/layout/checks/v2",
			secret: "abc123",
			mockBaseUrl:
				"https://abc123.mock.localman.test/very/long/prefix/for/layout/checks/v2",
		}),
		{ flags: ALL_FEATURES, path: `/projects/${PROJECT_ID}${path}` },
	);
}

describe("API endpoint card", () => {
	beforeEach(() => {
		resetCurrentUserCache();
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
	});
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("hides the kept-mounted MCP panel under every other tab", async () => {
		renderTabs();
		await screen.findByRole("tab", { name: "REST" });
		const mcp = byId("project-detail-mcp");
		expect(mcp).toHaveAttribute("data-state", "inactive");
		// Radix drops `hidden` with forceMount; this class hides it instead.
		expect(mcp).toHaveClass("data-[state=inactive]:hidden");
		await userEvent.click(screen.getByRole("tab", { name: "Upstream" }));
		expect(byId("project-detail-mcp")).toHaveAttribute(
			"data-state",
			"inactive",
		);
		await userEvent.click(screen.getByRole("tab", { name: "MCP" }));
		expect(byId("project-detail-mcp")).toHaveAttribute("data-state", "active");
	});

	it("shows the MCP tools as loading, not empty, while resources load", async () => {
		const resources = held();
		renderTabs({ [`GET ${RESOURCES_PATH}`]: resources.route }, "?endpoint=mcp");
		await waitFor(() =>
			expect(byId("project-detail-mcp-tools-loading")).not.toBeNull(),
		);
		expect(screen.queryByText(/No tools yet/)).toBeNull();
		await act(async () => resources.release(TREE));
		await waitFor(() =>
			expect(byId("project-detail-mcp-tools-loading")).toBeNull(),
		);
		expect(byId("mcp-tool-list_users")).not.toBeNull();
	});

	it("lets a long prefix wrap at its slashes", async () => {
		renderTabs();
		await screen.findByRole("tab", { name: "REST" });
		const prefix = byId("project-detail-endpoint-prefix");
		expect(prefix).toHaveTextContent("/very/long/prefix/for/layout/checks/v2");
		expect(prefix?.querySelectorAll("wbr")).toHaveLength(7);
		expect(prefix).not.toHaveClass("whitespace-nowrap");
		expect(byId("project-detail-endpoint-resource")).toHaveClass(
			"whitespace-nowrap",
		);
	});

	it("clamps a long name to two lines and keeps it whole in the title", async () => {
		renderTabs();
		const heading = await screen.findByRole("heading", { level: 1 });
		expect(heading).toHaveTextContent(LONG_NAME);
		expect(heading).toHaveAttribute("title", LONG_NAME);
		expect(heading).toHaveClass("line-clamp-2");
		expect(heading).not.toHaveClass("truncate");
	});

	it("fades the tab row while tabs hide at the right, centring the chosen one", async () => {
		// jsdom has no layout: a 200px row holding 500px of 100px tabs.
		const box = (element: HTMLElement, key: string, value: number) =>
			Object.defineProperty(element, key, { configurable: true, value });
		renderTabs();
		const row = await screen.findByRole("tablist");
		box(row, "clientWidth", 200);
		box(row, "scrollWidth", 500);
		for (const [index, tab] of screen.getAllByRole("tab").entries()) {
			box(tab, "offsetLeft", index * 100);
			box(tab, "offsetWidth", 100);
		}
		act(() => {
			row.scrollLeft = 0;
			row.dispatchEvent(new Event("scroll"));
		});
		expect(byId("project-detail-endpoint-tabs-fade")).not.toBeNull();
		await userEvent.click(screen.getByRole("tab", { name: "Request log" }));
		// Tab 4 of 5 (300–400px) centred in 200px: scrollLeft 250.
		expect(row.scrollLeft).toBe(250);
		act(() => {
			row.scrollLeft = 300;
			row.dispatchEvent(new Event("scroll"));
		});
		expect(byId("project-detail-endpoint-tabs-fade")).toBeNull();
	});
});
