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
	screen.getByRole("button", { name: `Chọn ${name} để di chuyển` });
const nestButton = (moving: string, target: string) =>
	screen.getByRole("button", { name: `Lồng ${moving} vào ${target}` });

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
		expect(screen.getByText(/Đang chọn/)).toHaveTextContent("Đang chọn users.");
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
			screen.getByRole("button", { name: "Thêm vào root" }),
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
			await screen.findByText("posts đã nằm trong users."),
		).toBeInTheDocument();
		await userEvent.click(nestButton("posts", "comments"));
		expect(
			await screen.findByText(
				"Không thể lồng posts vào comments vì sẽ tạo vòng lặp.",
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
			.getAllByRole("button", { name: "Chọn posts để di chuyển" })
			.at(-1);
		if (!rootPosts) throw new Error("missing root posts");
		await userEvent.click(rootPosts);
		await userEvent.click(nestButton("posts", "users"));
		expect(
			await screen.findByText("Đã có resource tên posts ở vị trí này."),
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
		expect(
			screen.getByRole("button", { name: "Thêm vào root" }),
		).toHaveAttribute("data-active", "true");
		await userEvent.click(
			screen.getByRole("button", { name: "Thêm vào root" }),
		);
		const dialog = await screen.findByRole("dialog", {
			name: "Di chuyển resource",
		});
		expect(dialog).toHaveTextContent("Đưa “posts” về root?");
		expect(within(dialog).getByRole("list")).toHaveTextContent(
			"posts: 25 → 0 bản ghi",
		);
		expect(within(dialog).queryByText(/comments/)).toBeNull();
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Di chuyển" }),
		);
		expect(await findToast("Đã đưa posts về root.")).toBeInTheDocument();
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
		expect(await findToast("Đã lồng likes vào users.")).toBeInTheDocument();
		expect(screen.queryByRole("dialog")).toBeNull();
		await waitFor(() =>
			expect(calls.filter((c) => c.method === "PUT")).toHaveLength(2),
		);

		await userEvent.click(selectButton("likes"));
		await userEvent.click(nestButton("likes", "comments"));
		expect(
			await screen.findByText("Cây resource chỉ lồng được tối đa 10 cấp."),
		).toBeInTheDocument();
	});
});
