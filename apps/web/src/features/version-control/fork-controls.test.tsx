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

afterEach(() => vi.unstubAllGlobals());

const FLAGS = { ...FLAGS_ON, forks: true };
const C = "/api/v1/collections/c1";
const NOT_A_FORK = { fork: null, forkCount: 2 };
const A_FORK = {
	forkCount: 0,
	fork: {
		label: "eve-fork",
		createdBy: "u2",
		createdByName: "Eve",
		createdAt: "2026-10-16T01:00:00.000Z",
		source: { id: "c9", name: "Orders API", available: true },
	},
};

function renderShop(routes: Record<string, MockRoute> = {}, flags = FLAGS) {
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
			[`GET ${C}/fork-status`]: { body: NOT_A_FORK },
			...routes,
		},
		{ flags },
	);
}

async function openShop() {
	const user = userEvent.setup();
	await user.click(await findRow("c1"));
	return user;
}

describe("forks on the collection page", () => {
	it("forks into a chosen workspace with a label", async () => {
		const { calls } = renderShop({
			[`POST ${C}/forks`]: {
				status: 201,
				body: detail("f1", [], { name: "Shop" }),
			},
		});
		const user = await openShop();
		await waitFor(() => expect(byId("collection-header-fork")).not.toBeNull());
		const fork = byId("collection-header-fork") as HTMLElement;
		await waitFor(() => expect(fork).toHaveTextContent("2"));
		await user.click(fork);
		const dialog = await screen.findByRole("dialog", { name: "Fork Shop" });
		const label = within(dialog).getByRole("textbox", { name: "Fork label" });
		await user.clear(label);
		await user.type(label, "my-change");
		await user.click(within(dialog).getByRole("button", { name: "Fork" }));
		await waitFor(() =>
			expect(calls.find((c) => c.method === "POST")?.body).toMatchObject({
				label: "my-change",
			}),
		);
	});

	it("pulls the source's changes after a choice for each conflict", async () => {
		const { calls } = renderShop({
			[`GET ${C}/fork-status`]: { body: A_FORK },
			[`GET ${C}/pull`]: {
				body: {
					changes: [{ kind: "changed", entityKind: "request", name: "List" }],
					conflicts: [
						{
							id: "r1:draft.url",
							entityKind: "request",
							name: "List",
							path: "draft.url",
							base: "https://a",
							source: "https://s",
							destination: "https://d",
						},
					],
				},
			},
			[`POST ${C}/pull`]: { body: { done: true } },
		});
		const user = await openShop();
		await waitFor(() => expect(byId("fork-badge")).not.toBeNull());
		expect(byId("fork-badge")).toHaveTextContent("eve-fork");
		expect(byId("fork-badge")).toHaveAttribute(
			"title",
			expect.stringContaining("Orders API"),
		);
		await user.click(screen.getByRole("button", { name: "Pull changes" }));
		const dialog = await screen.findByRole("dialog", {
			name: "Pull changes from Orders API",
		});
		expect(
			await within(dialog).findByText("Changed request List"),
		).toBeVisible();
		const submit = within(dialog).getByRole("button", { name: "Pull changes" });
		expect(submit).toBeDisabled();
		await user.click(
			within(dialog).getByRole("button", { name: "Keep all source" }),
		);
		expect(submit).toBeEnabled();
		await user.click(submit);
		await waitFor(() =>
			expect(calls.find((c) => c.method === "POST")?.body).toEqual({
				resolutions: { "r1:draft.url": "source" },
			}),
		);
	});

	it("offers only a plain merge to a Viewer of the fork", async () => {
		renderShop({
			[`GET ${C}`]: {
				body: detail("c1", [], { name: "Shop", role: "viewer" }),
			},
			[`GET ${C}/fork-status`]: { body: A_FORK },
			[`GET ${C}/merge`]: {
				body: {
					changes: [{ kind: "added", entityKind: "request", name: "Create" }],
					conflicts: [],
				},
			},
		});
		const user = await openShop();
		expect(screen.queryByRole("button", { name: "Pull changes" })).toBeNull();
		await waitFor(() => expect(byId("fork-badge")).not.toBeNull(), {
			timeout: 3000,
		});
		await waitFor(() => expect(byId("fork-merge")).not.toBeNull());
		await user.click(byId("fork-merge") as HTMLElement);
		const dialog = await screen.findByRole("dialog", {
			name: "Merge into Orders API",
		});
		await within(dialog).findByText("Added request Create");
		expect(
			within(dialog).getByRole("radio", { name: "Merge changes" }),
		).toBeChecked();
		expect(
			within(dialog).getByRole("radio", {
				name: "Merge changes and delete this fork",
			}),
		).toBeDisabled();
	});

	it("is absent while the forks flag is off", async () => {
		renderShop({}, FLAGS_ON);
		await openShop();
		await waitFor(() => expect(byId("collection-header")).not.toBeNull());
		expect(byId("collection-header-fork")).toBeNull();
		expect(byId("right-rail-forks")).toBeNull();
	});
});
