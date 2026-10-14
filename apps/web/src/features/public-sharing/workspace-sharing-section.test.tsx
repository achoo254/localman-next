import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FetchCall, MockReply } from "../../test/mock-fetch";
import {
	FLAGS_ON,
	LIST,
	PERSONAL,
	TEAM,
	TEAM_PATH,
	chooseWorkspace,
	renderSettings,
} from "../workspaces/workspaces-test-helpers";

const FLAGS = { ...FLAGS_ON, publicSharing: true };
const SHARING = `${TEAM_PATH}/sharing`;
const ALL_ON = {
	publicLinksAllowed: true,
	guestsAllowed: true,
	accessKeysAllowed: true,
};

describe("Workspace settings, Public sharing", () => {
	beforeEach(() => chooseWorkspace("w-team"));
	afterEach(() => vi.unstubAllGlobals());

	it("stays hidden while the flag is off", async () => {
		renderSettings({});
		await screen.findByRole("heading", {
			level: 1,
			name: "Workspace settings",
		});
		expect(
			screen.queryByRole("heading", { name: "Public sharing" }),
		).toBeNull();
	});

	it("turns a switch off after a dry run shows what stops", async () => {
		const patch = (call: FetchCall): MockReply => {
			const dryRun = call.query.get("dryRun") === "true";
			return {
				body: {
					dryRun,
					sharing: { ...ALL_ON, publicLinksAllowed: dryRun },
					stopped: { links: 2, accessKeys: 0, runButtons: 1 },
				},
			};
		};
		const { calls } = renderSettings(
			{ [`GET ${SHARING}`]: { body: ALL_ON }, [`PATCH ${SHARING}`]: patch },
			{ flags: FLAGS },
		);
		const toggle = await screen.findByRole("switch", { name: "Public links" });
		expect(toggle).toHaveAttribute("aria-checked", "true");
		await userEvent.click(toggle);

		const modal = await screen.findByRole("dialog", {
			name: "Turn off Public links",
		});
		const counts = await within(modal).findAllByRole("listitem");
		expect(counts.map((li) => li.textContent)).toEqual([
			"2 links",
			"0 access keys",
			"1 Run button",
		]);
		const patches = () => calls.filter((c) => c.method === "PATCH");
		expect(patches()).toHaveLength(1);
		expect(patches()[0]?.query.get("dryRun")).toBe("true");
		expect(patches()[0]?.body).toEqual({ publicLinksAllowed: false });

		await userEvent.click(
			within(modal).getByRole("button", { name: "Turn off" }),
		);
		await waitFor(() =>
			expect(
				screen.getByRole("switch", { name: "Public links" }),
			).toHaveAttribute("aria-checked", "false"),
		);
		expect(patches()).toHaveLength(2);
		expect(patches()[1]?.query.get("dryRun")).toBeNull();
		expect(patches()[1]?.body).toEqual({ publicLinksAllowed: false });
	});

	it("turns a switch on at once", async () => {
		const { calls } = renderSettings(
			{
				[`GET ${SHARING}`]: { body: { ...ALL_ON, guestsAllowed: false } },
				[`PATCH ${SHARING}`]: {
					body: {
						dryRun: false,
						sharing: ALL_ON,
						stopped: { links: 0, accessKeys: 0, runButtons: 0 },
					},
				},
			},
			{ flags: FLAGS },
		);
		await userEvent.click(
			await screen.findByRole("switch", { name: "Guest links" }),
		);
		await waitFor(() =>
			expect(
				screen.getByRole("switch", { name: "Guest links" }),
			).toHaveAttribute("aria-checked", "true"),
		);
		const patch = calls.find((c) => c.method === "PATCH");
		expect(patch?.query.get("dryRun")).toBeNull();
		expect(patch?.body).toEqual({ guestsAllowed: true });
	});

	it("shows the switches read-only to members who are not Admins", async () => {
		renderSettings(
			{
				[LIST]: { body: { items: [PERSONAL, { ...TEAM, role: "editor" }] } },
				[`GET ${SHARING}`]: { body: ALL_ON },
			},
			{ flags: FLAGS },
		);
		const toggle = await screen.findByRole("switch", { name: "Access keys" });
		expect(toggle).toBeDisabled();
		expect(
			screen.getByText("Only Admins can change these settings."),
		).toBeInTheDocument();
	});
});
