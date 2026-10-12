import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FetchCall } from "../../test/mock-fetch";
import {
	ENV_PATH,
	GLOBALS,
	LIST,
	byId,
	environment,
	openStaging,
	renderEnvironments,
	summary,
	variable,
} from "./environments-test-utils";

afterEach(() => vi.unstubAllGlobals());

const FAILED = {
	status: 500,
	body: { error: { code: "INTERNAL", message: "Something broke" } },
};
const LOCAL = [{ key: "host", value: "local.test" }];
const writes = (calls: FetchCall[], method: string) =>
	calls.filter((call) => call.method === method);

describe("sharing when the shared save fails", () => {
	it("keeps the environment's local values", async () => {
		const user = userEvent.setup();
		const { calls } = renderEnvironments({
			[`GET ${LIST}`]: { body: { items: [summary()] } },
			[`GET ${ENV_PATH}`]: {
				body: environment({
					variables: [variable("host", "shared.test")],
					localValues: LOCAL,
				}),
			},
			[`PUT ${ENV_PATH}/variables`]: FAILED,
		});
		const table = await openStaging(user);
		const more = byId("environment-header-more");
		if (!more) throw new Error("no More button");
		await user.click(more);
		await user.click(
			await screen.findByRole("menuitem", { name: "Update all shared values" }),
		);
		await waitFor(() => expect(writes(calls, "PUT")).toHaveLength(1), {
			timeout: 3000,
		});
		await screen.findByRole("button", { name: "Try again" });
		expect(writes(calls, "PATCH")).toHaveLength(0);
		expect(
			within(table).getByRole("textbox", { name: "Local value of host" }),
		).toHaveValue("local.test");
	});

	it("keeps the globals' local values", async () => {
		const user = userEvent.setup();
		const { calls } = renderEnvironments({
			[`GET ${LIST}`]: { body: { items: [] } },
			[`GET ${GLOBALS}`]: {
				body: {
					workspaceId: "w-team",
					role: "editor",
					variables: [variable("host", "shared.test")],
					localValues: LOCAL,
					updatedAt: null,
				},
			},
			[`PUT ${GLOBALS}`]: FAILED,
		});
		await user.click(await screen.findByRole("button", { name: "Envs" }));
		await user.click(await screen.findByRole("button", { name: "Globals" }));
		await user.click(
			await screen.findByRole("button", { name: "More actions for host" }),
		);
		await user.click(
			await screen.findByRole("menuitem", { name: "Update shared value" }),
		);
		await waitFor(() => expect(writes(calls, "PUT")).toHaveLength(1), {
			timeout: 3000,
		});
		await screen.findByRole("button", { name: "Try again" });
		expect(writes(calls, "PATCH")).toHaveLength(0);
		expect(
			screen.getByRole("textbox", { name: "Local value of host" }),
		).toHaveValue("local.test");
	});
});
