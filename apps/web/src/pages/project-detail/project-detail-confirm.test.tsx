import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetCurrentUserCache } from "../../features/auth/use-current-user";
import type { MockReply } from "../../test/mock-fetch";
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

function held() {
	let release: (reply: MockReply) => void = () => {};
	const reply = new Promise<MockReply>((resolve) => {
		release = resolve;
	});
	return { route: () => reply, release: (r: MockReply) => release(r) };
}

describe("Delete resource while the dry run is pending or fails", () => {
	beforeEach(() => resetCurrentUserCache());
	afterEach(() => vi.unstubAllGlobals());

	it("keeps Delete resource off until the dry run answers", async () => {
		const preview = held();
		renderDetail({
			[`GET ${RESOURCES_PATH}`]: { body: { items: sampleTree() } },
			[`DELETE ${RESOURCES_PATH}/users`]: preview.route,
		});
		const users = await findNode("users");
		await userEvent.click(
			within(users).getByRole("button", { name: "Delete users" }),
		);
		const dialog = await screen.findByRole("dialog", {
			name: "Delete resource",
		});
		const confirm = within(dialog).getByRole("button", {
			name: "Delete resource",
		});
		expect(confirm).toBeDisabled();
		preview.release({
			body: {
				dryRun: true,
				removed: [{ resourceId: "users", name: "users", count: 10 }],
			},
		});
		await waitFor(() => expect(confirm).toBeEnabled());
	});

	it("warns about children in general when the dry run fails", async () => {
		renderDetail({
			[`GET ${RESOURCES_PATH}`]: { body: { items: sampleTree() } },
			[`DELETE ${RESOURCES_PATH}/users`]: apiError(500, "INTERNAL"),
		});
		const users = await findNode("users");
		await userEvent.click(
			within(users).getByRole("button", { name: "Delete users" }),
		);
		const dialog = await screen.findByRole("dialog", {
			name: "Delete resource",
		});
		expect(
			await within(dialog).findByText(
				"Every child resource and its data will be deleted too.",
			),
		).toBeInTheDocument();
		expect(
			within(dialog).getByRole("button", { name: "Delete resource" }),
		).toBeEnabled();
	});
});

describe("bulk buttons stay busy", () => {
	beforeEach(() => resetCurrentUserCache());
	afterEach(() => vi.unstubAllGlobals());

	it("until the real Generate all request has finished", async () => {
		const real = held();
		const empty = sampleTree().map((r) => ({ ...r, count: 0 }));
		renderDetail({
			[`GET ${RESOURCES_PATH}`]: { body: { items: empty } },
			[`POST ${RESOURCES_PATH}/generate_all`]: ({ query }) =>
				query.get("dryRun") === "true"
					? { body: { dryRun: true, changes: [change("users", 0, 10)] } }
					: real.route(),
		});
		await findNode("users");
		const generateAll = screen.getByRole("button", { name: "Generate all" });
		await userEvent.click(generateAll);
		await waitFor(() => expect(generateAll).toBeDisabled());
		expect(screen.getByRole("button", { name: "Reset all" })).toBeDisabled();
		real.release({
			body: { dryRun: false, changes: [change("users", 0, 10)] },
		});
		expect(await findToast("1 resource has new data.")).toBeInTheDocument();
		expect(generateAll).toBeEnabled();
	});
});

describe("node addresses", () => {
	beforeEach(() => resetCurrentUserCache());
	afterEach(() => vi.unstubAllGlobals());

	it("uses the resource id in data-id and keeps the name in data-name", async () => {
		renderDetail({
			[`GET ${RESOURCES_PATH}`]: {
				body: {
					items: [resourceJson("64f0c0ffee0000000000000a", { name: "users" })],
				},
			},
		});
		const link = await screen.findByRole("link", { name: "users" });
		const node = link.closest("[data-name]");
		expect(node).toHaveAttribute(
			"data-id",
			"resource-node-64f0c0ffee0000000000000a",
		);
		expect(node).toHaveAttribute("data-name", "users");
		expect(link).toHaveAttribute(
			"data-id",
			"resource-node-64f0c0ffee0000000000000a-link",
		);
	});
});
