import type { CollectionDetail } from "@localman/shared/api-client";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
import {
	FLAGS_ON,
	LIST_PATH,
	byId,
	detail,
	findRow,
	renderWorkbenchPage,
	summary,
} from "./collections-test-utils";

afterEach(() => vi.unstubAllGlobals());

const LINKED = detail("c1", [], {
	name: "Shop",
	variables: [{ key: "baseUrl", value: "https://shared.test" }],
	relatedEnvironment: {
		id: "e1",
		name: "Staging",
		color: "green",
		source: "shared",
	},
	mockProject: { id: "p1", name: "Demo shop" },
});
const LOCAL_PATH = "/api/v1/collections/c1/local-values";

function renderShop(start: CollectionDetail, flags = ENV_FLAGS) {
	let stored = start;
	const api = renderWorkbenchPage(
		{
			[`GET ${LIST_PATH}`]: () => ({
				body: { items: [summary("c1", { name: "Shop", role: stored.role })] },
			}),
			"GET /api/v1/collections/c1": () => ({ body: stored }),
			"PATCH /api/v1/collections/c1": () => {
				stored = { ...stored, relatedEnvironment: null };
				return { body: stored };
			},
			[`GET ${LIST}`]: { body: { items: [environmentSummary()] } },
			[`GET ${ACTIVE}`]: {
				body: { workspaceId: "w-team", environmentId: null },
			},
			[`GET ${GLOBALS}`]: { body: EMPTY_GLOBALS },
			"GET /api/v1/environments/e1": { body: environment() },
			[`GET ${LOCAL_PATH}`]: { body: { localValues: [] } },
			[`PATCH ${LOCAL_PATH}`]: {
				body: { localValues: [{ key: "baseUrl", value: "https://mine.test" }] },
			},
		},
		{ flags },
	);
	return api;
}

async function openShop() {
	const user = userEvent.setup();
	await user.click(await findRow("c1"));
	await screen.findByRole("tab", { name: /Shop/ });
	return user;
}

describe("related environment and mock project", () => {
	it("shows both in the Overview and lets an Editor unlink the environment", async () => {
		const { calls } = renderShop(LINKED);
		const user = await openShop();
		await waitFor(() =>
			expect(byId("collection-meta-env")).toHaveTextContent("Staging"),
		);
		expect(screen.getByText("Shared with this collection")).toBeVisible();
		expect(byId("collection-meta-mock")).toHaveAttribute(
			"href",
			"/projects/p1",
		);
		const picker = byId("collection-meta-env-select");
		if (!picker) throw new Error("no picker");
		await waitFor(() => expect(picker).toBeEnabled());
		await user.selectOptions(picker, "");
		expect(
			await screen.findByText(
				"This collection has no related environment now.",
			),
		).toBeVisible();
		expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({
			linkedEnvironmentId: null,
		});
		expect(byId("collection-meta-env")).toBeNull();
	});

	it("opens the related environment as a tab", async () => {
		renderShop(LINKED);
		const user = await openShop();
		const chip = await waitFor(() => {
			const element = byId("collection-meta-env");
			if (!element) throw new Error("no chip");
			return element;
		});
		await user.click(chip);
		expect(
			await screen.findByRole("tab", { name: /Staging/ }),
		).toBeInTheDocument();
	});

	it("lists creation date, role and links in the Info rail, read only", async () => {
		renderShop({ ...LINKED, role: "viewer" });
		const user = await openShop();
		const info = byId("right-rail-info");
		if (!info) throw new Error("no rail");
		await user.click(info);
		const panel = await waitFor(() => {
			const element = byId("right-info");
			if (!element) throw new Error("no info");
			return element;
		});
		expect(within(panel).getByText("Created")).toBeVisible();
		expect(within(panel).getByText("Your role")).toBeVisible();
		expect(within(panel).getByText("Viewer")).toBeVisible();
		expect(within(panel).getByText("Demo shop")).toBeVisible();
		expect(within(panel).getByText("Staging")).toBeVisible();
		expect(
			document.querySelector('[data-id="collection-meta-env-select"]'),
		).toBeNull();
	});

	it("leaves the environment out while environments are off", async () => {
		renderShop({ ...LINKED, mockProject: null }, FLAGS_ON);
		await openShop();
		await waitFor(() =>
			expect(byId("collection-request-count")).not.toBeNull(),
		);
		expect(byId("collection-meta-env")).toBeNull();
		expect(screen.queryByText("Related environment")).toBeNull();
		expect(screen.getByText("Not linked")).toBeVisible();
	});
});

describe("local values of collection variables", () => {
	it("lets a Viewer set their own value beside the shared one", async () => {
		const { calls } = renderShop({ ...LINKED, role: "viewer" });
		const user = await openShop();
		await user.click(screen.getByRole("tab", { name: "Variables" }));
		const local = await screen.findByRole("textbox", {
			name: "Local value of baseUrl",
		});
		const shared = screen.getByRole("textbox", {
			name: "Shared value of baseUrl",
		});
		expect(shared).toHaveAttribute("readonly");
		expect(local).toHaveAttribute("placeholder", "https://shared.test");
		await waitFor(() => expect(local).toBeEnabled());
		await user.type(local, "https://mine.test");
		await user.tab();
		await waitFor(() =>
			expect(
				calls.find((c) => c.method === "PATCH" && c.path === LOCAL_PATH)?.body,
			).toEqual({ values: [{ key: "baseUrl", value: "https://mine.test" }] }),
		);
		expect(
			await screen.findByDisplayValue("https://mine.test"),
		).toBeInTheDocument();
	});
});
