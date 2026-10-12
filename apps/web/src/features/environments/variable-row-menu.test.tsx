import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { copyText } from "../../platform/clipboard";
import type { FetchCall } from "../../test/mock-fetch";
import {
	ENV_PATH,
	LIST,
	environment,
	openStaging,
	renderEnvironments,
	summary,
	variable,
} from "./environments-test-utils";

vi.mock("../../platform/clipboard", () => ({
	copyText: vi.fn(async () => true),
}));

afterEach(() => {
	vi.unstubAllGlobals();
	vi.mocked(copyText).mockClear();
});

const SAVE = { timeout: 3000 };
type Role = "editor" | "viewer";

// baseUrl: shared, your local differs · newVar: not shared, local only
// region: shared, no local value
const staging = (role: Role) =>
	environment({
		role,
		variables: [
			variable("baseUrl", "https://staging.test"),
			variable("newVar", null),
			variable("region", "eu"),
		],
		localValues: [
			{ key: "baseUrl", value: "http://localhost:3000" },
			{ key: "newVar", value: "abc" },
		],
	});

function renderStaging(role: Role = "editor") {
	return renderEnvironments(
		{
			[`GET ${LIST}`]: { body: { items: [summary({ role })] } },
			[`GET ${ENV_PATH}`]: { body: staging(role) },
			[`PUT ${ENV_PATH}/variables`]: { body: staging(role) },
			[`PATCH ${ENV_PATH}/local-values`]: { body: { localValues: [] } },
		},
		{ role: role === "editor" ? "admin" : "viewer" },
	);
}

const sent = (calls: FetchCall[], method: string, path: string) =>
	calls.filter((call) => call.method === method && call.path === path);
const puts = (calls: FetchCall[]) =>
	sent(calls, "PUT", `${ENV_PATH}/variables`);
const patches = (calls: FetchCall[]) =>
	sent(calls, "PATCH", `${ENV_PATH}/local-values`);

async function openRowMenu(
	user: ReturnType<typeof userEvent.setup>,
	key: string,
): Promise<string[]> {
	await user.click(
		screen.getByRole("button", { name: `More actions for ${key}` }),
	);
	const items = await screen.findAllByRole("menuitem");
	return items.map((item) => item.textContent ?? "");
}

describe("menu of one variable", () => {
	it("Update shared value pushes the local value and resets it", async () => {
		const user = userEvent.setup();
		const { calls } = renderStaging();
		await openStaging(user);
		expect(await openRowMenu(user, "baseUrl")).toEqual([
			"Update shared value",
			"Reset value",
			"Unshare",
			"Copy value",
			"Delete variable",
		]);
		await user.click(
			screen.getByRole("menuitem", { name: "Update shared value" }),
		);
		await waitFor(() => expect(puts(calls)).toHaveLength(1), SAVE);
		expect(puts(calls)[0]?.body).toMatchObject({
			variables: [
				{ key: "baseUrl", sharedValue: "http://localhost:3000" },
				{ key: "newVar", sharedValue: null },
				{ key: "region", sharedValue: "eu" },
			],
		});
		await waitFor(
			() =>
				expect(patches(calls)[0]?.body).toEqual({
					values: [{ key: "baseUrl", value: null }],
				}),
			SAVE,
		);
	});

	it("Share value shares a value nobody shared yet", async () => {
		const user = userEvent.setup();
		const { calls } = renderStaging();
		await openStaging(user);
		await openRowMenu(user, "newVar");
		await user.click(screen.getByRole("menuitem", { name: "Share value" }));
		await waitFor(() => expect(puts(calls)).toHaveLength(1), SAVE);
		expect(puts(calls)[0]?.body).toMatchObject({
			variables: [{}, { key: "newVar", sharedValue: "abc" }, {}],
		});
	});

	it("Reset value drops only the local value", async () => {
		const user = userEvent.setup();
		const { calls } = renderStaging();
		await openStaging(user);
		await openRowMenu(user, "baseUrl");
		await user.click(screen.getByRole("menuitem", { name: "Reset value" }));
		await waitFor(() => expect(patches(calls)).toHaveLength(1), SAVE);
		expect(patches(calls)[0]?.body).toEqual({
			values: [{ key: "baseUrl", value: null }],
		});
		expect(puts(calls)).toHaveLength(0);
	});

	it("Unshare removes the shared value without keeping it as local", async () => {
		const user = userEvent.setup();
		const { calls } = renderStaging();
		await openStaging(user);
		expect(await openRowMenu(user, "region")).not.toContain("Reset value");
		await user.click(screen.getByRole("menuitem", { name: "Unshare" }));
		await waitFor(() => expect(puts(calls)).toHaveLength(1), SAVE);
		expect(puts(calls)[0]?.body).toMatchObject({
			variables: [{}, {}, { key: "region", sharedValue: null }],
		});
		expect(patches(calls)).toHaveLength(0);
	});

	it("Copy value copies the value in use", async () => {
		const user = userEvent.setup();
		renderStaging();
		await openStaging(user);
		await openRowMenu(user, "baseUrl");
		await user.click(screen.getByRole("menuitem", { name: "Copy value" }));
		expect(copyText).toHaveBeenCalledWith("http://localhost:3000");
		expect(await screen.findByText("Copied the value.")).toBeVisible();
	});

	it("gives a Viewer Reset value and Copy value only", async () => {
		const user = userEvent.setup();
		renderStaging("viewer");
		await openStaging(user);
		expect(await openRowMenu(user, "baseUrl")).toEqual([
			"Reset value",
			"Copy value",
		]);
		await user.keyboard("{Escape}");
		expect(await openRowMenu(user, "region")).toEqual(["Copy value"]);
	});
});
