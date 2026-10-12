import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	ACTIVE,
	EMPTY_GLOBALS,
	ENV_FLAGS,
	GLOBALS,
	LIST,
} from "../environments/environments-test-utils";
import {
	LIST_PATH,
	detail,
	findRow,
	renderWorkbenchPage,
	summary,
} from "./collections-test-utils";

afterEach(() => vi.unstubAllGlobals());

const LOCAL_PATH = "/api/v1/collections/c1/local-values";
const SHOP = detail("c1", [], {
	name: "Shop",
	variables: [{ key: "baseUrl", value: "https://shared.test" }],
});

function renderShop() {
	let local = [{ key: "baseUrl", value: "https://mine.test" }];
	return renderWorkbenchPage(
		{
			[`GET ${LIST_PATH}`]: {
				body: { items: [summary("c1", { name: "Shop" })] },
			},
			"GET /api/v1/collections/c1": { body: SHOP },
			"PATCH /api/v1/collections/c1": { body: SHOP },
			[`GET ${LIST}`]: { body: { items: [] } },
			[`GET ${ACTIVE}`]: {
				body: { workspaceId: "w-team", environmentId: null },
			},
			[`GET ${GLOBALS}`]: { body: EMPTY_GLOBALS },
			[`GET ${LOCAL_PATH}`]: () => ({ body: { localValues: local } }),
			[`PATCH ${LOCAL_PATH}`]: ({ body }) => {
				const writes = (
					body as { values: { key: string; value: string | null }[] }
				).values;
				for (const write of writes) {
					local = local.filter((v) => v.key !== write.key);
					if (write.value !== null)
						local.push({ key: write.key, value: write.value });
				}
				return { body: { localValues: local } };
			},
		},
		{ flags: ENV_FLAGS },
	);
}

async function openVariables() {
	const user = userEvent.setup();
	await user.click(await findRow("c1"));
	await user.click(await screen.findByRole("tab", { name: "Variables" }));
	return user;
}

describe("own values of collection variables", () => {
	it("moves the caller's value when a variable is renamed", async () => {
		const { calls } = renderShop();
		const user = await openVariables();
		const local = await screen.findByRole("textbox", {
			name: "Local value of baseUrl",
		});
		await waitFor(() => expect(local).toHaveValue("https://mine.test"));
		const key = screen.getByRole("textbox", { name: "Key of row 1" });
		await user.clear(key);
		await user.type(key, "apiUrl");
		await user.tab();
		await waitFor(() =>
			expect(
				calls.find((c) => c.method === "PATCH" && c.path === LOCAL_PATH)?.body,
			).toEqual({
				values: [
					{ key: "apiUrl", value: "https://mine.test" },
					{ key: "baseUrl", value: null },
				],
			}),
		);
		const moved = await screen.findByRole("textbox", {
			name: "Local value of apiUrl",
		});
		await waitFor(() => expect(moved).toHaveValue("https://mine.test"));
	});

	it("keeps what is typed while the box has focus, then saves it", async () => {
		const { calls } = renderShop();
		const user = await openVariables();
		const local = await screen.findByRole("textbox", {
			name: "Local value of baseUrl",
		});
		await waitFor(() => expect(local).toHaveValue("https://mine.test"));
		await user.clear(local);
		await user.type(local, "https://other.test");
		expect(local).toHaveFocus();
		expect(local).toHaveValue("https://other.test");
		await user.tab();
		await waitFor(() =>
			expect(
				calls.find((c) => c.method === "PATCH" && c.path === LOCAL_PATH)?.body,
			).toEqual({ values: [{ key: "baseUrl", value: "https://other.test" }] }),
		);
		await waitFor(() => expect(local).toHaveValue("https://other.test"));
	});
});
