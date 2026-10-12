import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	GLOBALS,
	LIST,
	renderEnvironments,
	variable,
} from "./environments-test-utils";

afterEach(() => vi.unstubAllGlobals());

describe("globals page", () => {
	const patchesOf = (
		calls: { method: string; path: string; body: unknown }[],
	) =>
		calls.filter(
			(c) => c.method === "PATCH" && c.path === `${GLOBALS}/local-values`,
		);

	it("offers the same actions on the Globals page", async () => {
		const user = userEvent.setup();
		const { calls } = renderEnvironments({
			[`GET ${LIST}`]: { body: { items: [] } },
			[`GET ${GLOBALS}`]: {
				body: {
					workspaceId: "w-team",
					role: "editor",
					variables: [variable("host", "a.test")],
					localValues: [{ key: "host", value: "b.test" }],
					updatedAt: null,
				},
			},
			[`PATCH ${GLOBALS}/local-values`]: { body: { localValues: [] } },
		});
		await user.click(await screen.findByRole("button", { name: "Envs" }));
		await user.click(await screen.findByRole("button", { name: "Globals" }));
		await user.click(
			await screen.findByRole("button", { name: "More actions for Globals" }),
		);
		await user.click(
			await screen.findByRole("menuitem", { name: "Reset all" }),
		);
		const dialog = await screen.findByRole("dialog", { name: "Reset all" });
		await user.click(within(dialog).getByRole("button", { name: "Reset all" }));
		await waitFor(() => expect(patchesOf(calls)).toHaveLength(1));
		expect(patchesOf(calls)[0]?.body).toEqual({
			values: [{ key: "host", value: null }],
		});
	});
});
