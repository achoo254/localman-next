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
		await userEvent.click(screen.getByRole("button", { name: "Generate all" }));
		const dialog = await screen.findByRole("dialog", { name: "Generate all" });
		expect(within(dialog).getByRole("list")).toHaveTextContent(
			"users: 10 → 10 records",
		);
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Generate data" }),
		);
		expect(await screen.findByText("Data generated")).toBeInTheDocument();
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
		await userEvent.click(screen.getByRole("button", { name: "Generate all" }));
		expect(await screen.findByText("Data generated")).toBeInTheDocument();
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
		await userEvent.click(screen.getByRole("button", { name: "Reset all" }));
		const dialog = await screen.findByRole("dialog", { name: "Reset all" });
		const list = within(dialog).getByRole("list");
		expect(list).toHaveTextContent("users: 10 → 0 records");
		expect(list).not.toHaveTextContent("likes");
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Reset data" }),
		);
		expect(await screen.findByText("Data reset")).toBeInTheDocument();
		expect(bar(await findNode("users"))).toHaveAttribute("aria-valuenow", "0");
	});

	it("says there is nothing to reset in an empty project", async () => {
		renderDetail({
			[`GET ${RESOURCES_PATH}`]: { body: { items: [] } },
			[`POST ${RESOURCES_PATH}/reset_all`]: dryRunAware([], []),
		});
		await screen.findByText(/No resources yet/);
		await userEvent.click(screen.getByRole("button", { name: "Reset all" }));
		expect(
			await screen.findByText("There's no data to reset yet."),
		).toBeInTheDocument();
		await userEvent.click(screen.getByRole("button", { name: "Generate all" }));
		expect(
			await screen.findByText("This project has no resources yet."),
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
			within(users).getByRole("button", { name: "Delete users" }),
		);
		const dialog = await screen.findByRole("dialog", {
			name: "Delete resource",
		});
		expect(
			within(dialog).getByText(/The schema, endpoints and 10 records/),
		).toBeInTheDocument();
		const cascade = await within(dialog).findByText(
			/This also deletes 2 child resources/,
		);
		expect(cascade).toHaveTextContent("posts (4 records)");
		expect(cascade).toHaveTextContent("comments (0 records)");
		expect(
			within(dialog).getByRole("button", { name: "Cancel" }),
		).toHaveFocus();
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Delete resource" }),
		);
		expect(await findToast("Deleted resource users.")).toBeInTheDocument();
		const deletes = calls.filter((c) => c.method === "DELETE");
		expect(deletes.map((c) => c.query.get("dryRun"))).toEqual(["true", null]);
	});
});
