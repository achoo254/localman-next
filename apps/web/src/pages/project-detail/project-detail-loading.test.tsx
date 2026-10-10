import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetCurrentUserCache } from "../../features/auth/use-current-user";
import { resourcesKey } from "../../features/resources/use-resources";
import { seriousViolations } from "../../test/axe";
import { makeProject } from "../../test/fixtures";
import {
	PROJECT_ID,
	RESOURCES_PATH,
	findNode,
	held,
	renderDetail,
	sampleTree,
	watchFor,
} from "./project-detail-test-helpers";

const PROJECT_PATH = `/api/v1/projects/${PROJECT_ID}`;
const TREE = { body: { items: sampleTree() } };
const byId = (id: string) => document.querySelector(`[data-id="${id}"]`);

describe("ProjectDetailPage loading states", () => {
	beforeEach(() => resetCurrentUserCache());
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("shows a page skeleton with a tree on a slow load, announced once", async () => {
		const project = held();
		const { container } = renderDetail({
			[`GET ${PROJECT_PATH}`]: project.route,
			[`GET ${RESOURCES_PATH}`]: TREE,
		});
		const region = await waitFor(() => {
			const found = byId("project-detail-loading");
			if (!found) throw new Error("no skeleton yet");
			return found;
		});
		expect(region).toHaveAttribute("aria-busy", "true");
		expect(byId("resource-tree-skeleton")).not.toBeNull();
		await waitFor(() =>
			expect(screen.getByRole("status")).toHaveTextContent("Loading project…"),
		);
		expect(screen.getAllByRole("status")).toHaveLength(1);
		expect(await seriousViolations(container)).toEqual([]);
		await act(async () =>
			project.release({ body: makeProject(PROJECT_ID, { name: "Demo" }) }),
		);
		expect(
			await screen.findByRole("heading", { level: 1, name: "Demo" }),
		).toBeInTheDocument();
		expect(byId("project-detail-loading")).toBeNull();
	});

	it("shows no skeleton when the project and tree answer at once", async () => {
		const seen = watchFor(
			'[data-id="project-detail-loading"], [data-id="project-detail-tree-loading"]',
		);
		renderDetail({ [`GET ${RESOURCES_PATH}`]: TREE });
		await findNode("likes");
		expect(seen()).toBe(false);
	});

	it("shapes the resources card like the tree while the list is slow", async () => {
		const tree = held();
		renderDetail({ [`GET ${RESOURCES_PATH}`]: tree.route });
		await waitFor(() =>
			expect(byId("project-detail-tree-loading")).not.toBeNull(),
		);
		expect(
			byId("project-detail-tree-loading")?.querySelector(
				'[data-id="resource-tree-skeleton"]',
			),
		).not.toBeNull();
		await act(async () => tree.release(TREE));
		await findNode("likes");
		expect(byId("project-detail-tree-loading")).toBeNull();
	});

	it("keeps the tree and runs the panel bar during a slow refetch", async () => {
		let slow: ReturnType<typeof held> | null = null;
		const { queryClient } = renderDetail({
			[`GET ${RESOURCES_PATH}`]: () => (slow ? slow.route() : TREE),
		});
		await findNode("likes");
		const refetch = held();
		slow = refetch;
		act(
			() =>
				void queryClient.invalidateQueries({
					queryKey: resourcesKey(PROJECT_ID),
				}),
		);
		const panel = byId("project-detail-tree-panel");
		await waitFor(() =>
			expect(panel?.querySelector('[data-id="panel-progress"]')).toBeTruthy(),
		);
		expect(panel).toHaveAttribute("aria-busy", "true");
		expect(await findNode("likes")).toBeInTheDocument();
		await act(async () => refetch.release(TREE));
		await waitFor(() =>
			expect(panel?.querySelector('[data-id="panel-progress"]')).toBeNull(),
		);
	});

	it("spins Generate all during its dry run and keeps it focused", async () => {
		const dryRun = held();
		renderDetail({
			[`GET ${RESOURCES_PATH}`]: TREE,
			[`POST ${RESOURCES_PATH}/generate_all`]: ({ query }) =>
				query.get("dryRun") === "true"
					? dryRun.route()
					: { body: { dryRun: false, changes: [] } },
		});
		await findNode("likes");
		const generate = screen.getByRole("button", { name: "Generate all" });
		const reset = screen.getByRole("button", { name: "Reset all" });
		await userEvent.click(generate);
		expect(generate).toHaveAttribute("aria-busy", "true");
		expect(generate).toHaveFocus();
		expect(reset).toBeDisabled();
		expect(reset).not.toHaveAttribute("aria-busy");
		await act(async () =>
			dryRun.release({ body: { dryRun: true, changes: [] } }),
		);
		await waitFor(() => expect(generate).not.toHaveAttribute("aria-busy"));
	});
});
