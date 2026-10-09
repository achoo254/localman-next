import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetCurrentUserCache } from "../../features/auth/use-current-user";
import type { MockReply } from "../../test/mock-fetch";
import { findToast } from "../../test/toast";
import {
	RESOURCES_PATH,
	apiError,
	bar,
	change,
	findNode,
	renderDetail,
	resourceJson,
	sampleTree,
} from "./project-detail-test-helpers";

/** A response the test releases when it wants. */
function held() {
	let release: (reply: MockReply) => void = () => {};
	const reply = new Promise<MockReply>((resolve) => {
		release = resolve;
	});
	return { route: () => reply, release: (r: MockReply) => release(r) };
}

/** Clicks the bar of `name` at `count` (the bar is 106px wide at x = 0). */
async function clickBar(name: string, count: number) {
	const slider = bar(await findNode(name));
	slider.getBoundingClientRect = () => new DOMRect(0, 0, 106, 25);
	fireEvent.click(slider, { clientX: (count / 100) * 106 });
	return slider;
}

const generatePath = (name: string) => `${RESOURCES_PATH}/${name}/generate`;

describe("generator writes in a row", () => {
	beforeEach(() => resetCurrentUserCache());
	afterEach(() => vi.unstubAllGlobals());

	it("sends one request at a time and keeps a success when a later write fails", async () => {
		const items = sampleTree();
		const users = held();
		const { calls } = renderDetail({
			[`GET ${RESOURCES_PATH}`]: () => ({ body: { items } }),
			[`POST ${generatePath("users")}`]: users.route,
			[`POST ${generatePath("likes")}`]: apiError(500, "INTERNAL"),
		});
		const usersBar = await clickBar("users", 30);
		const likesBar = await clickBar("likes", 50);
		await waitFor(() =>
			expect(likesBar).toHaveAttribute("aria-valuenow", "50"),
		);
		expect(usersBar).toHaveAttribute("aria-valuenow", "30");
		// The likes request waits for the users answer.
		expect(calls.filter((c) => c.method === "POST").map((c) => c.path)).toEqual(
			[generatePath("users")],
		);
		items[0] = resourceJson("users", { count: 30 });
		users.release({
			body: { dryRun: false, changes: [change("users", 10, 30)] },
		});
		await waitFor(() => expect(likesBar).toHaveAttribute("aria-valuenow", "0"));
		expect(usersBar).toHaveAttribute("aria-valuenow", "30");
		await waitFor(() =>
			expect(
				calls.filter((c) => c.method === "GET" && c.path === RESOURCES_PATH),
			).toHaveLength(2),
		);
		expect(usersBar).toHaveAttribute("aria-valuenow", "30");
	});

	it("puts each resource back to its own count when both writes fail", async () => {
		const users = held();
		renderDetail({
			[`GET ${RESOURCES_PATH}`]: { body: { items: sampleTree() } },
			[`POST ${generatePath("users")}`]: users.route,
			[`POST ${generatePath("likes")}`]: apiError(500, "INTERNAL"),
		});
		const usersBar = await clickBar("users", 30);
		const likesBar = await clickBar("likes", 50);
		await waitFor(() =>
			expect(likesBar).toHaveAttribute("aria-valuenow", "50"),
		);
		users.release(apiError(500, "INTERNAL"));
		await waitFor(() => expect(likesBar).toHaveAttribute("aria-valuenow", "0"));
		expect(usersBar).toHaveAttribute("aria-valuenow", "10");
	});
});

describe("generator writes that drop child data", () => {
	beforeEach(() => resetCurrentUserCache());
	afterEach(() => vi.unstubAllGlobals());

	function withPostsData() {
		return sampleTree().map((r) =>
			r.id === "posts" ? { ...r, count: 40 } : r,
		);
	}

	it("lists the children that lose records and writes only after confirmation", async () => {
		const { calls } = renderDetail({
			[`GET ${RESOURCES_PATH}`]: { body: { items: withPostsData() } },
			[`POST ${generatePath("users")}`]: ({ query }) => ({
				body: {
					dryRun: query.get("dryRun") === "true",
					changes: [change("users", 10, 0), change("posts", 40, 0)],
				},
			}),
		});
		await clickBar("users", 0);
		const dialog = await screen.findByRole("dialog", { name: "Delete data" });
		const list = within(dialog).getByRole("list");
		expect(list).toHaveTextContent("posts: 40 → 0 records");
		expect(list).not.toHaveTextContent("users");
		const posts = () => calls.filter((c) => c.method === "POST");
		expect(posts().map((c) => c.query.get("dryRun"))).toEqual(["true"]);
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Delete data" }),
		);
		expect(await findToast("users has no records now.")).toBeInTheDocument();
		expect(posts().map((c) => c.query.get("dryRun"))).toEqual(["true", null]);
	});

	it("writes at once when the dry run shows no child loses data", async () => {
		const { calls } = renderDetail({
			[`GET ${RESOURCES_PATH}`]: { body: { items: withPostsData() } },
			[`POST ${generatePath("users")}`]: () => ({
				body: { dryRun: false, changes: [change("users", 10, 60)] },
			}),
		});
		await clickBar("users", 60);
		expect(await findToast("60 records for users.")).toBeInTheDocument();
		expect(screen.queryByRole("dialog")).toBeNull();
		const posts = calls.filter((c) => c.method === "POST");
		expect(posts.map((c) => c.query.get("dryRun"))).toEqual(["true", null]);
	});

	it("skips the dry run when no child holds data", async () => {
		const { calls } = renderDetail({
			[`GET ${RESOURCES_PATH}`]: { body: { items: sampleTree() } },
			[`POST ${generatePath("users")}`]: () => ({
				body: { dryRun: false, changes: [change("users", 10, 0)] },
			}),
		});
		await clickBar("users", 0);
		expect(await findToast("users has no records now.")).toBeInTheDocument();
		const posts = calls.filter((c) => c.method === "POST");
		expect(posts.map((c) => c.query.get("dryRun"))).toEqual([null]);
	});
});
