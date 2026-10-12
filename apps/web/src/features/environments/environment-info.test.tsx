import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { copyText } from "../../platform/clipboard";
import {
	ACTIVE,
	ENV_PATH,
	LIST,
	byId,
	environment,
	openStaging,
	renderEnvironments,
	summary,
} from "./environments-test-utils";

vi.mock("../../platform/clipboard", () => ({
	copyText: vi.fn(async () => true),
}));

afterEach(() => {
	vi.unstubAllGlobals();
	vi.mocked(copyText).mockClear();
});

const USED = `${ENV_PATH}/collections`;

function renderStaging(
	activeId: string | null,
	createdByName: string | null,
	used: { id: string; name: string; source: string }[] = [],
) {
	return renderEnvironments({
		[`GET ${USED}`]: { body: { items: used } },
		[`GET ${LIST}`]: { body: { items: [summary()] } },
		[`GET ${ENV_PATH}`]: { body: environment({ createdByName }) },
		[`GET ${ACTIVE}`]: {
			body: { workspaceId: "w-team", environmentId: activeId },
		},
	});
}

async function openInfo(user = userEvent.setup()) {
	await openStaging(user);
	await user.click(screen.getByRole("button", { name: "Info" }));
	return screen.findByRole("complementary", { name: "Info" });
}

describe("environment Info rail", () => {
	it("shows the ID, creator, dates and that it is active for you", async () => {
		const user = userEvent.setup();
		renderStaging("e1", "Ada Lovelace");
		const panel = await openInfo(user);
		expect(byId("right-panel-info-id")).toHaveTextContent("e1");
		expect(byId("environment-created-by")).toHaveTextContent("Ada Lovelace");
		expect(byId("environment-created-at")).toHaveTextContent("2026");
		expect(byId("environment-updated-at")).toHaveTextContent("2026");
		await waitFor(() =>
			expect(byId("environment-active-for-you")).toHaveTextContent("Yes"),
		);
		await user.click(within(panel).getByRole("button", { name: "Copy ID" }));
		expect(copyText).toHaveBeenCalledWith("e1");
		expect(await screen.findByText("Copied the ID.")).toBeVisible();
	});

	it("says No when another environment is active, and names an unknown creator", async () => {
		renderStaging(null, null);
		await openInfo();
		await waitFor(() =>
			expect(byId("environment-active-for-you")).toHaveTextContent("No"),
		);
		expect(byId("environment-created-by")).toHaveTextContent(
			"A workspace member",
		);
	});

	it("has only the Info panel, and closes it", async () => {
		const user = userEvent.setup();
		renderStaging(null, "Ada Lovelace");
		await openInfo(user);
		const rail = byId("right-rail");
		if (!rail) throw new Error("no rail");
		expect(within(rail).getAllByRole("button")).toHaveLength(1);
		expect(
			screen.queryByRole("button", { name: /Forks|Pull requests/ }),
		).toBeNull();
		const close = byId("right-panel-close");
		if (!close) throw new Error("no close button");
		await user.click(close);
		expect(screen.queryByRole("complementary", { name: "Info" })).toBeNull();
	});

	it("lists the collections using it and opens one", async () => {
		const user = userEvent.setup();
		const { calls } = renderStaging(null, "Ada Lovelace", [
			{ id: "c1", name: "Shop API", source: "linked" },
			{ id: "c2", name: "Admin API", source: "shared" },
		]);
		const panel = await openInfo(user);
		const shop = await within(panel).findByRole("button", {
			name: "Open Shop API",
		});
		expect(shop).toHaveTextContent("Linked");
		expect(
			within(panel).getByRole("button", { name: "Open Admin API" }),
		).toHaveTextContent("Shared with it");
		await user.click(shop);
		await waitFor(() =>
			expect(calls.some((c) => c.path === "/api/v1/collections/c1")).toBe(true),
		);
	});

	it("says when no collection uses it", async () => {
		renderStaging(null, null);
		const panel = await openInfo();
		expect(
			await within(panel).findByText(
				"No collection is linked to or shared with this environment.",
			),
		).toBeVisible();
	});
});
