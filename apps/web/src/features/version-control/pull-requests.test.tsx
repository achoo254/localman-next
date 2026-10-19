import type { PullRequestDetail } from "@localman/shared/api-client";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MockRoute } from "../../test/mock-fetch";
import {
	FLAGS_ON,
	LIST_PATH,
	byId,
	detail,
	findRow,
	renderWorkbenchPage,
	request,
	summary,
} from "../collections/collections-test-utils";
import { clearPullRequestFocus } from "./pull-request-focus";

afterEach(() => {
	vi.unstubAllGlobals();
	clearPullRequestFocus();
});

const FLAGS = { ...FLAGS_ON, forks: true };
const C = "/api/v1/collections/c1";
const PR = "/api/v1/pull-requests/p1";
const A_FORK = {
	forkCount: 0,
	fork: {
		label: "eve-fork",
		createdBy: "u2",
		createdByName: "Eve",
		createdAt: "2026-10-16T01:00:00.000Z",
		source: { id: "c9", name: "Orders API", available: true, canMerge: true },
	},
};

const PULL_REQUEST: PullRequestDetail = {
	id: "p1",
	sourceId: "c1",
	sourceName: "Shop",
	forkId: "f1",
	forkLabel: "eve-fork",
	title: "Use v2",
	description: "Moves **List** to v2.",
	authorId: "u2",
	authorName: "Eve",
	reviewers: [{ userId: "u1", name: "Ada", decision: "pending", at: null }],
	status: "open",
	mergedByName: null,
	mergedAt: null,
	createdAt: "2026-10-16T01:00:00.000Z",
	canReview: true,
	canMerge: true,
	canEdit: false,
	preview: {
		changes: [
			{ key: "r1", kind: "changed", entityKind: "request", name: "List" },
		],
		conflicts: [],
	},
};

function renderShop(routes: Record<string, MockRoute> = {}) {
	return renderWorkbenchPage(
		{
			[`GET ${LIST_PATH}`]: {
				body: { items: [summary("c1", { name: "Shop" })] },
			},
			[`GET ${C}`]: {
				body: detail("c1", [request("r1", null, "a0", "List")], {
					name: "Shop",
				}),
			},
			[`GET ${C}/fork-status`]: { body: { fork: null, forkCount: 1 } },
			[`GET ${C}/pull-requests`]: { body: { items: [PULL_REQUEST] } },
			[`GET ${PR}`]: { body: PULL_REQUEST },
			[`GET ${PR}/comments`]: { body: { threads: [] } },
			"GET /api/v1/workspaces/w-team/members": {
				body: { members: [], invitations: [], seats: null },
			},
			...routes,
		},
		{ flags: FLAGS },
	);
}

/** Opens Shop, its Pull requests panel and the pull request "Use v2". */
async function openPullRequest() {
	const user = userEvent.setup();
	await user.click(await findRow("c1"));
	await user.click(
		await screen.findByRole("button", { name: "Pull requests" }),
	);
	await user.click(
		await screen.findByRole("button", { name: "Open pull request Use v2" }),
	);
	return {
		user,
		dialog: await screen.findByRole("dialog", { name: "Use v2" }),
	};
}

describe("pull requests", () => {
	it("opens one from a fork with chosen reviewers", async () => {
		const { calls } = renderShop({
			[`GET ${C}/fork-status`]: { body: A_FORK },
			[`GET ${C}/pull-request-reviewers`]: {
				body: { items: [{ userId: "u1", username: "ada", name: "Ada" }] },
			},
			[`POST ${C}/pull-requests`]: {
				status: 201,
				body: { ...PULL_REQUEST, preview: undefined },
			},
		});
		const user = userEvent.setup();
		await user.click(await findRow("c1"));
		await waitFor(() => expect(byId("fork-pull-request")).not.toBeNull());
		await user.click(byId("fork-pull-request") as HTMLElement);
		const dialog = await screen.findByRole("dialog", {
			name: "Pull request into Orders API",
		});
		await user.type(
			within(dialog).getByRole("textbox", { name: "Title" }),
			"Use v2",
		);
		await user.click(await within(dialog).findByRole("checkbox"));
		await user.click(
			within(dialog).getByRole("button", { name: "Create pull request" }),
		);
		await waitFor(() =>
			expect(
				calls.find(
					(c) => c.method === "POST" && c.path.endsWith("/pull-requests"),
				)?.body,
			).toEqual({ title: "Use v2", description: "", reviewerIds: ["u1"] }),
		);
	});

	it("shows its changes, takes a comment on one and an approval", async () => {
		const { calls } = renderShop({
			[`POST ${PR}/comments`]: {
				status: 201,
				body: { id: "m1", threadId: "m1", nodeId: null },
			},
			[`PUT ${PR}/review`]: {
				body: { ...PULL_REQUEST, status: "approved", preview: undefined },
			},
		});
		const { user, dialog } = await openPullRequest();
		expect(within(dialog).getByText("Changed request List")).toBeVisible();
		expect(within(dialog).getByText("Waiting")).toBeVisible();
		await user.click(byId("pull-request-change-comment") as HTMLElement);
		await user.type(
			await within(dialog).findByRole("combobox", { name: "Comment on List" }),
			"Why v2?",
		);
		await user.click(byId("pull-request-change-composer-send") as HTMLElement);
		await waitFor(() =>
			expect(
				calls.find((c) => c.method === "POST" && c.path === `${PR}/comments`)
					?.body,
			).toEqual({ body: "Why v2?", changeKey: "r1" }),
		);
		await user.click(within(dialog).getByRole("button", { name: "Approve" }));
		await waitFor(() =>
			expect(calls.find((c) => c.method === "PUT")?.body).toEqual({
				decision: "approved",
			}),
		);
	});

	it("shows the diff of a change on demand", async () => {
		const { calls } = renderShop({
			[`GET ${PR}/changes/r1/diff`]: {
				body: {
					before: { name: "List", url: "https://api.example.com" },
					after: { name: "List", url: "https://api.example.com/v2" },
				},
			},
		});
		const { user, dialog } = await openPullRequest();
		expect(calls.some((c) => c.path.endsWith("/diff"))).toBe(false);
		await user.click(within(dialog).getByRole("button", { name: "Show diff" }));
		const diff = await within(dialog).findByRole("region", {
			name: "Changes to List",
		});
		expect(diff).toHaveTextContent("https://api.example.com/v2");
		expect(
			within(dialog).getByRole("button", { name: "Hide diff" }),
		).toHaveAttribute("aria-expanded", "true");
	});

	it("merges it with the plain option", async () => {
		const { calls } = renderShop({
			[`POST ${PR}/merge`]: {
				body: {
					pullRequest: {
						...PULL_REQUEST,
						status: "merged",
						preview: undefined,
					},
					followUp: "none",
				},
			},
		});
		const { user, dialog } = await openPullRequest();
		await user.click(within(dialog).getByRole("button", { name: "Merge" }));
		const merge = await screen.findByRole("dialog", { name: "Merge Use v2" });
		await user.click(within(merge).getByRole("button", { name: "Merge" }));
		await waitFor(() =>
			expect(calls.find((c) => c.path === `${PR}/merge`)?.body).toEqual({
				option: "merge",
				resolutions: {},
			}),
		);
		// Back on the pull request once merged.
		expect(await screen.findByRole("dialog", { name: "Use v2" })).toBeVisible();
	});
});
