import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetCurrentUserCache } from "../../features/auth/use-current-user";
import { findToast } from "../../test/toast";
import {
	RESOURCES_PATH,
	apiError,
	change,
	findNode,
	renderDetail,
	resourceJson,
	sampleTree,
} from "./project-detail-test-helpers";

const selectButton = (name: string) =>
	screen.getByRole("button", { name: `Select ${name} to move` });
const nestButton = (moving: string, target: string) =>
	screen.getByRole("button", { name: `Nest ${moving} into ${target}` });

describe("nesting resources with the connectors", () => {
	beforeEach(() => resetCurrentUserCache());
	afterEach(() => vi.unstubAllGlobals());

	it("marks valid and refused targets once a resource is selected", async () => {
		renderDetail({
			[`GET ${RESOURCES_PATH}`]: { body: { items: sampleTree() } },
		});
		await findNode("users");
		await userEvent.click(selectButton("users"));
		expect(selectButton("users")).toHaveAttribute("aria-pressed", "true");
		expect(screen.getByText(/Selected/)).toHaveTextContent("Selected users.");
		// Its own descendants would make a cycle; likes is fine.
		expect(nestButton("users", "posts")).toHaveAttribute(
			"data-state",
			"invalid",
		);
		expect(nestButton("users", "comments")).toHaveAttribute(
			"aria-disabled",
			"true",
		);
		expect(nestButton("users", "likes")).toHaveAttribute(
			"data-state",
			"target",
		);
		// Already at the root: the rail is not a target.
		expect(
			screen.getByRole("button", { name: "Add to root" }),
		).not.toHaveAttribute("data-active");
	});

	it("explains refused moves without calling the API", async () => {
		const { calls } = renderDetail({
			[`GET ${RESOURCES_PATH}`]: { body: { items: sampleTree() } },
		});
		await findNode("posts");
		await userEvent.click(selectButton("posts"));
		await userEvent.click(nestButton("posts", "users"));
		expect(
			await screen.findByText("posts is already in users."),
		).toBeInTheDocument();
		await userEvent.click(nestButton("posts", "comments"));
		expect(
			await screen.findByText(
				"Can't nest posts into comments because it would create a loop.",
			),
		).toBeInTheDocument();
		await userEvent.keyboard("{Escape}");
		expect(selectButton("posts")).toHaveAttribute("aria-pressed", "false");
		expect(calls.some((call) => call.method === "PUT")).toBe(false);
	});

	it("refuses a sibling with the same name", async () => {
		renderDetail({
			[`GET ${RESOURCES_PATH}`]: {
				body: {
					items: [...sampleTree(), resourceJson("posts-2", { name: "posts" })],
				},
			},
		});
		await findNode("likes");
		const rootPosts = screen
			.getAllByRole("button", { name: "Select posts to move" })
			.at(-1);
		if (!rootPosts) throw new Error("missing root posts");
		await userEvent.click(rootPosts);
		await userEvent.click(nestButton("posts", "users"));
		expect(
			await screen.findByText("There's already a resource named posts here."),
		).toBeInTheDocument();
	});

	it("previews the data reset with a dry run, then moves after confirmation", async () => {
		const { calls } = renderDetail({
			[`GET ${RESOURCES_PATH}`]: { body: { items: sampleTree() } },
			[`PUT ${RESOURCES_PATH}/posts/parent`]: ({ query }) => ({
				body: {
					dryRun: query.get("dryRun") === "true",
					resource: resourceJson("posts"),
					changes: [change("posts", 25, 0), change("comments", 0, 0)],
				},
			}),
		});
		await findNode("posts");
		await userEvent.click(selectButton("posts"));
		expect(screen.getByRole("button", { name: "Add to root" })).toHaveAttribute(
			"data-active",
			"true",
		);
		await userEvent.click(screen.getByRole("button", { name: "Add to root" }));
		const dialog = await screen.findByRole("dialog", {
			name: "Move resource",
		});
		expect(dialog).toHaveTextContent("Move “posts” to the root?");
		expect(within(dialog).getByRole("list")).toHaveTextContent(
			"posts: 25 → 0 records",
		);
		expect(within(dialog).queryByText(/comments/)).toBeNull();
		await userEvent.click(within(dialog).getByRole("button", { name: "Move" }));
		expect(await findToast("Moved posts to the root.")).toBeInTheDocument();
		const puts = calls.filter((call) => call.method === "PUT");
		expect(puts.map((call) => call.query.get("dryRun"))).toEqual([
			"true",
			null,
		]);
		expect(puts[1]?.body).toEqual({ parentId: null });
	});

	it("moves at once when no data would be reset, and maps API refusals", async () => {
		const { calls } = renderDetail({
			[`GET ${RESOURCES_PATH}`]: { body: { items: sampleTree() } },
			[`PUT ${RESOURCES_PATH}/likes/parent`]: ({ body }) =>
				(body as { parentId: string }).parentId === "comments"
					? apiError(409, "TREE_TOO_DEEP")
					: {
							body: {
								dryRun: false,
								resource: resourceJson("likes"),
								changes: [change("likes", 0, 0)],
							},
						},
		});
		await findNode("likes");
		await userEvent.click(selectButton("likes"));
		await userEvent.click(nestButton("likes", "users"));
		expect(await findToast("Nested likes into users.")).toBeInTheDocument();
		expect(screen.queryByRole("dialog")).toBeNull();
		await waitFor(() =>
			expect(calls.filter((c) => c.method === "PUT")).toHaveLength(2),
		);

		await userEvent.click(selectButton("likes"));
		await userEvent.click(nestButton("likes", "comments"));
		expect(
			await screen.findByText(
				"The resource tree can be nested at most 10 levels deep.",
			),
		).toBeInTheDocument();
	});
});
