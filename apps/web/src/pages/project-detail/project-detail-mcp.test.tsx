import { mockToolEntries } from "@localman/shared/constants";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetCurrentUserCache } from "../../features/auth/use-current-user";
import { seriousViolations } from "../../test/axe";
import { makeProject } from "../../test/fixtures";
import { ALL_FEATURES } from "../landing/landing-test-helpers";
import {
	PROJECT_ID,
	RESOURCES_PATH,
	renderDetail,
	resourceJson,
	sampleTree,
} from "./project-detail-test-helpers";

const TOKEN_PATH = `/api/v1/projects/${PROJECT_ID}/mcp-token`;
const MCP_URL = "https://abc123.mock.localman.test/api/v1/mcp";
const OFF = { body: { required: false, token: null } };

function renderMcp(items = sampleTree(), path = "?endpoint=mcp") {
	return renderDetail(
		{
			[`GET ${RESOURCES_PATH}`]: { body: { items } },
			[`GET ${TOKEN_PATH}`]: OFF,
		},
		undefined,
		{ flags: ALL_FEATURES, path: `/projects/${PROJECT_ID}${path}` },
	);
}

function toolIds(): string[] {
	return [...document.querySelectorAll('[data-id^="mcp-tool-"]')].map(
		(item) => item.getAttribute("data-id") ?? "",
	);
}

describe("MCP tab of the endpoint card", () => {
	beforeEach(() => {
		resetCurrentUserCache();
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
	});
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("has no tabs while the mockMcp flag is off", async () => {
		renderDetail({ [`GET ${RESOURCES_PATH}`]: { body: { items: [] } } });
		await screen.findByText("API endpoint");
		expect(screen.queryByRole("tablist")).toBeNull();
		expect(document.body).not.toHaveTextContent(/MCP/);
	});

	it("keeps the selected tab in ?endpoint=", async () => {
		const { router } = renderMcp(sampleTree(), "");
		const rest = await screen.findByRole("tab", { name: "REST" });
		expect(rest).toHaveAttribute("aria-selected", "true");
		await userEvent.click(screen.getByRole("tab", { name: "MCP" }));
		expect(router.state.location.search).toBe("?endpoint=mcp");
		expect(screen.getByRole("tabpanel")).toHaveAttribute(
			"data-id",
			"project-detail-mcp",
		);
		await userEvent.click(screen.getByRole("tab", { name: "REST" }));
		expect(router.state.location.search).toBe("");
	});

	it("shows the URL and agent snippets without any token", async () => {
		renderMcp();
		expect(await screen.findByDisplayValue(MCP_URL)).toBeInTheDocument();
		const output = () =>
			document.querySelector('[data-id="project-detail-mcp-config-output"]');
		await waitFor(() =>
			expect(output()).toHaveTextContent(
				`claude mcp add --transport http localman-demo-shop ${MCP_URL}`,
			),
		);
		expect(screen.getByRole("button", { name: "Claude Code" })).toHaveAttribute(
			"aria-pressed",
			"true",
		);
		await userEvent.click(screen.getByRole("button", { name: "Cursor" }));
		expect(output()).toHaveTextContent('"localman-demo-shop"');
		expect(output()).not.toHaveTextContent("Authorization");
		expect(
			document.querySelector('[data-id="project-detail-mcp-config-hint"]'),
		).toHaveTextContent("No token needed");
	});

	it("lists the tools of enabled endpoints in the shared order", async () => {
		const tree = sampleTree();
		const likes = tree[3];
		if (!likes) throw new Error("no likes");
		likes.endpoints = (likes.endpoints as { method: string }[]).map(
			(endpoint) => ({ ...endpoint, enabled: endpoint.method === "GET" }),
		);
		renderMcp(tree);
		await waitFor(() => expect(toolIds()).not.toHaveLength(0));
		const expected = mockToolEntries(
			tree.map((resource) => ({
				id: resource.id,
				parentId: resource.parentId,
				name: resource.name,
				endpoints: resource.endpoints as {
					method: string;
					path: string;
					enabled: boolean;
				}[],
			})),
		).map((entry) => `mcp-tool-${entry.name}`);
		expect(toolIds()).toEqual(expected);
		expect(expected).toContain("mcp-tool-get_likes");
		expect(expected).not.toContain("mcp-tool-delete_likes");
		const posts = document.querySelector('[data-id="mcp-tool-create_posts"]');
		expect(posts).toHaveTextContent("parentId, body matching the schema");
		expect(
			document.querySelector('[data-id="mcp-tool-delete_users"]'),
		).toHaveTextContent("destructive");
	});

	it("explains why there are no tools", async () => {
		const off = resourceJson("users", {
			endpoints: [{ method: "GET", path: "/:res", enabled: false }],
		});
		const view = renderMcp([off]);
		const empty = await screen.findByText(/Every endpoint is turned off/);
		expect(empty).toHaveAttribute("data-id", "project-detail-mcp-tools-empty");
		view.unmount();
		renderMcp([]);
		expect(await screen.findByText(/No tools yet/)).toBeInTheDocument();
	});

	it("opens the Inspector commands under 'Try' without calling anything", async () => {
		const { calls, container } = renderMcp();
		const button = await screen.findByRole("button", { name: "Try" });
		expect(button).toHaveAttribute("aria-expanded", "false");
		await userEvent.click(button);
		expect(button).toHaveAttribute("aria-expanded", "true");
		const panel = screen
			.getByText(/MCP Inspector is an open-source tool/)
			.closest("div");
		expect(panel).toBeVisible();
		expect(
			container.querySelector('[data-id="project-detail-mcp-try-command"]'),
		).toHaveTextContent(`--transport http --server-url ${MCP_URL}`);
		expect(calls.some((call) => call.path.includes("inspector"))).toBe(false);
		expect(await seriousViolations(container)).toEqual([]);
	});

	it("tells collaborators the owner manages the token", async () => {
		const { calls } = renderDetail(
			{ [`GET ${RESOURCES_PATH}`]: { body: { items: [] } } },
			makeProject(PROJECT_ID, { role: "collaborator" }),
			{ flags: ALL_FEATURES, path: `/projects/${PROJECT_ID}?endpoint=mcp` },
		);
		expect(
			await screen.findByText(/The project owner manages the MCP token/),
		).toBeInTheDocument();
		expect(screen.queryByRole("switch")).toBeNull();
		expect(calls.some((call) => call.path === TOKEN_PATH)).toBe(false);
	});

	it("warns that rotating the mock URL changes the MCP URL too", async () => {
		renderDetail(
			{
				[`GET ${RESOURCES_PATH}`]: { body: { items: [] } },
				[`GET ${TOKEN_PATH}`]: OFF,
				[`POST /api/v1/projects/${PROJECT_ID}/rotate-secret`]: {
					body: { dryRun: true, collaborators: 0 },
				},
			},
			undefined,
			{ flags: ALL_FEATURES },
		);
		await userEvent.click(
			await screen.findByRole("button", { name: "Change mock URL" }),
		);
		const dialog = screen.getByRole("dialog", { name: "Change mock URL" });
		expect(within(dialog).getByText(/The MCP URL changes too/)).toBeVisible();
	});
});
