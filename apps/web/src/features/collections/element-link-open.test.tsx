import { screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	ACTIVE,
	EMPTY_GLOBALS,
	ENV_FLAGS,
	GLOBALS,
	LIST,
	environment,
	summary as environmentSummary,
} from "../environments/environments-test-utils";
import { savedWorkspace } from "../workspaces/workspaces-test-helpers";
import {
	LIST_PATH,
	PERSONAL,
	detail,
	renderWorkbenchPage,
	summary,
} from "./collections-test-utils";

afterEach(() => vi.unstubAllGlobals());

const ELEMENT = (type: string, id: string, name: string) => ({
	body: { type, id, name, workspaceId: "w-team", role: "viewer" },
});

describe("element links open in the workbench", () => {
	it("switches to the collection's workspace and opens its page", async () => {
		const { calls, router } = renderWorkbenchPage(
			{
				"GET /api/v1/elements/collection/c1": ELEMENT(
					"collection",
					"c1",
					"Shop",
				),
				"GET /api/v1/workspaces/w-personal/collections": {
					body: { items: [] },
				},
				[`GET ${LIST_PATH}`]: {
					body: { items: [summary("c1", { name: "Shop", role: "viewer" })] },
				},
				"GET /api/v1/collections/c1": {
					body: detail("c1", [], { name: "Shop", role: "viewer" }),
				},
			},
			{ at: "/elements/collection/c1", workspace: PERSONAL.id },
		);
		expect(await screen.findByRole("tab", { name: /Shop/ })).toHaveAttribute(
			"aria-selected",
			"true",
		);
		expect(savedWorkspace()).toBe("w-team");
		expect(router.state.location.pathname).toBe("/api-client");
		// The state is read once, then cleared: a reload opens nothing more.
		await waitFor(() => expect(router.state.location.state).toBeNull());
		expect(calls.some((c) => c.path === LIST_PATH)).toBe(true);
	});

	it("opens a collection shared directly, flagged, without switching", async () => {
		renderWorkbenchPage(
			{
				"GET /api/v1/elements/collection/c7": {
					body: {
						type: "collection",
						id: "c7",
						name: "Partner API",
						workspaceId: "w-other",
						role: "viewer",
					},
				},
				[`GET ${LIST_PATH}`]: { body: { items: [] } },
				"GET /api/v1/collections/c7": {
					body: detail("c7", [], {
						name: "Partner API",
						role: "viewer",
						workspaceId: "w-other",
					}),
				},
			},
			{ at: "/elements/collection/c7" },
		);
		expect(
			await screen.findByRole("tab", { name: /Partner API/ }),
		).toHaveAttribute("aria-selected", "true");
		expect(
			await screen.findByText("Shared with you", {
				selector: "[data-id=collection-header-shared]",
			}),
		).toBeVisible();
		expect(savedWorkspace()).toBe("w-team");
	});

	it("opens an environment as its tab when environments are on", async () => {
		renderWorkbenchPage(
			{
				"GET /api/v1/elements/environment/e1": ELEMENT(
					"environment",
					"e1",
					"Staging",
				),
				[`GET ${LIST_PATH}`]: { body: { items: [] } },
				[`GET ${LIST}`]: { body: { items: [environmentSummary()] } },
				[`GET ${ACTIVE}`]: {
					body: { workspaceId: "w-team", environmentId: null },
				},
				[`GET ${GLOBALS}`]: { body: EMPTY_GLOBALS },
				"GET /api/v1/environments/e1": { body: environment() },
			},
			{ at: "/elements/environment/e1", flags: ENV_FLAGS },
		);
		expect(
			await screen.findByRole("tab", { name: /Staging/ }),
		).toBeInTheDocument();
	});
});
