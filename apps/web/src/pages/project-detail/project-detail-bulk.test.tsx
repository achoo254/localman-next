import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetCurrentUserCache } from "../../features/auth/use-current-user";
import { findToast } from "../../test/toast";
import {
	RESOURCES_PATH,
	bar,
	change,
	findNode,
	renderDetail,
	sampleTree,
} from "./project-detail-test-helpers";

const dryRunAware =
	(preview: ReturnType<typeof change>[], done: ReturnType<typeof change>[]) =>
	({ query }: { query: URLSearchParams }) => ({
		body:
			query.get("dryRun") === "true"
				? { dryRun: true, changes: preview }
				: { dryRun: false, changes: done },
	});

const GENERATED = [
	change("users", 10, 10),
	change("posts", 0, 10),
	change("comments", 0, 10),
	change("likes", 0, 10),
];

describe("Generate all and Reset all", () => {
	beforeEach(() => resetCurrentUserCache());
	afterEach(() => vi.unstubAllGlobals());

	it("asks before regenerating existing data, listing what changes", async () => {
		const { calls } = renderDetail({
			[`GET ${RESOURCES_PATH}`]: { body: { items: sampleTree() } },
			[`POST ${RESOURCES_PATH}/generate_all`]: dryRunAware(
				GENERATED,
				GENERATED,
			),
		});
		await findNode("likes");
		await userEvent.click(screen.getByRole("button", { name: "Sinh tất cả" }));
		const dialog = await screen.findByRole("dialog", { name: "Sinh tất cả" });
		expect(within(dialog).getByRole("list")).toHaveTextContent(
			"users: 10 → 10 bản ghi",
		);
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Sinh dữ liệu" }),
		);
		expect(await screen.findByText("Đã sinh dữ liệu")).toBeInTheDocument();
		expect(bar(await findNode("likes"))).toHaveAttribute("aria-valuenow", "10");
		const posts = calls.filter((c) => c.path.endsWith("/generate_all"));
		expect(posts.map((c) => c.query.get("dryRun"))).toEqual(["true", null]);
	});

	it("generates at once when nothing would be replaced", async () => {
		const empty = sampleTree().map((resource) => ({ ...resource, count: 0 }));
		const fresh = GENERATED.map((c) => ({ ...c, countBefore: 0 }));
		renderDetail({
			[`GET ${RESOURCES_PATH}`]: { body: { items: empty } },
			[`POST ${RESOURCES_PATH}/generate_all`]: dryRunAware(fresh, fresh),
		});
		await findNode("users");
		await userEvent.click(screen.getByRole("button", { name: "Sinh tất cả" }));
		expect(await screen.findByText("Đã sinh dữ liệu")).toBeInTheDocument();
		expect(screen.queryByRole("dialog")).toBeNull();
		expect(bar(await findNode("users"))).toHaveAttribute("aria-valuenow", "10");
	});

	it("resets every resource after confirmation", async () => {
		renderDetail({
			[`GET ${RESOURCES_PATH}`]: { body: { items: sampleTree() } },
			[`POST ${RESOURCES_PATH}/reset_all`]: dryRunAware(
				[change("users", 10, 0), change("likes", 0, 0)],
				[change("users", 10, 0)],
			),
		});
		await findNode("users");
		await userEvent.click(screen.getByRole("button", { name: "Reset tất cả" }));
		const dialog = await screen.findByRole("dialog", { name: "Reset tất cả" });
		const list = within(dialog).getByRole("list");
		expect(list).toHaveTextContent("users: 10 → 0 bản ghi");
		expect(list).not.toHaveTextContent("likes");
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Reset dữ liệu" }),
		);
		expect(await screen.findByText("Đã reset dữ liệu")).toBeInTheDocument();
		expect(bar(await findNode("users"))).toHaveAttribute("aria-valuenow", "0");
	});

	it("says there is nothing to reset in an empty project", async () => {
		renderDetail({
			[`GET ${RESOURCES_PATH}`]: { body: { items: [] } },
			[`POST ${RESOURCES_PATH}/reset_all`]: dryRunAware([], []),
		});
		await screen.findByText(/Chưa có resource nào/);
		await userEvent.click(screen.getByRole("button", { name: "Reset tất cả" }));
		expect(
			await screen.findByText("Chưa có dữ liệu nào để reset."),
		).toBeInTheDocument();
		await userEvent.click(screen.getByRole("button", { name: "Sinh tất cả" }));
		expect(
			await screen.findByText("Project chưa có resource nào."),
		).toBeInTheDocument();
	});
});

describe("Delete resource", () => {
	beforeEach(() => resetCurrentUserCache());
	afterEach(() => vi.unstubAllGlobals());

	it("lists the child resources a dry run says go with it", async () => {
		const removed = [
			{ resourceId: "users", name: "users", count: 10 },
			{ resourceId: "posts", name: "posts", count: 4 },
			{ resourceId: "comments", name: "comments", count: 0 },
		];
		const { calls } = renderDetail({
			[`GET ${RESOURCES_PATH}`]: { body: { items: sampleTree() } },
			[`DELETE ${RESOURCES_PATH}/users`]: ({ query }) => ({
				body: { dryRun: query.get("dryRun") === "true", removed },
			}),
		});
		const users = await findNode("users");
		await userEvent.click(
			within(users).getByRole("button", { name: "Xoá users" }),
		);
		const dialog = await screen.findByRole("dialog", { name: "Xoá resource" });
		expect(
			within(dialog).getByText(/Schema, endpoint và 10 bản ghi/),
		).toBeInTheDocument();
		const cascade = await within(dialog).findByText(
			/Sẽ xoá kèm 2 resource con/,
		);
		expect(cascade).toHaveTextContent("posts (4 bản ghi)");
		expect(cascade).toHaveTextContent("comments (0 bản ghi)");
		expect(within(dialog).getByRole("button", { name: "Huỷ" })).toHaveFocus();
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Xoá resource" }),
		);
		expect(await findToast("Đã xoá resource users.")).toBeInTheDocument();
		const deletes = calls.filter((c) => c.method === "DELETE");
		expect(deletes.map((c) => c.query.get("dryRun"))).toEqual(["true", null]);
	});
});
