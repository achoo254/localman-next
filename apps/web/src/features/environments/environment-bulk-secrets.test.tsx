import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FetchCall } from "../../test/mock-fetch";
import {
	ENV_PATH,
	LIST,
	byId,
	environment,
	openStaging,
	renderEnvironments,
	summary,
	variable,
} from "./environments-test-utils";

afterEach(() => vi.unstubAllGlobals());

// baseUrl: shared, local differs · token: shared secret, own value differs
const staging = environment({
	role: "editor",
	variables: [
		variable("baseUrl", "https://staging.test"),
		variable("token", "team-value", { type: "secret" }),
	],
	localValues: [
		{ key: "baseUrl", value: "http://localhost:3000" },
		{ key: "token", value: "my-own-value" },
	],
});

function renderStaging() {
	return renderEnvironments(
		{
			[`GET ${LIST}`]: { body: { items: [summary({ role: "editor" })] } },
			[`GET ${ENV_PATH}`]: { body: staging },
			[`PUT ${ENV_PATH}/variables`]: { body: staging },
			[`PATCH ${ENV_PATH}/local-values`]: { body: { localValues: [] } },
		},
		{ role: "admin" },
	);
}

const puts = (calls: FetchCall[]) =>
	calls.filter(
		(call) => call.method === "PUT" && call.path === `${ENV_PATH}/variables`,
	);

describe("sharing secrets with an “all” action", () => {
	it("asks first, naming the secrets that would leave the caller's values", async () => {
		const user = userEvent.setup();
		const { calls } = renderStaging();
		await openStaging(user);
		const more = byId("environment-header-more");
		if (!more) throw new Error("no More button");
		await user.click(more);
		await user.click(
			await screen.findByRole("menuitem", { name: "Update all shared values" }),
		);
		const dialog = await screen.findByRole("dialog");
		expect(within(dialog).getByText("token")).toBeVisible();
		expect(puts(calls)).toHaveLength(0);

		await user.click(
			within(dialog).getByRole("button", { name: "Update all shared values" }),
		);
		await waitFor(() => expect(puts(calls)).toHaveLength(1), {
			timeout: 3000,
		});
		expect(puts(calls)[0]?.body).toMatchObject({
			variables: [
				{ key: "baseUrl", sharedValue: "http://localhost:3000" },
				{ key: "token", sharedValue: "my-own-value" },
			],
		});
	});
});
