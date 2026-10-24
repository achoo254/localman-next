import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openStaging } from "../../environments/environments-test-utils";
import { lockVault, resetVaultSession, setVaultPrompt } from "../vault-session";
import {
	LOCAL,
	USES,
	agentServer,
	bodyOf,
	hostsBox,
	renderStaging,
	sent,
	toggle,
} from "./agent-use-test-support";

beforeEach(() => {
	agentServer.refuse = "";
	resetVaultSession();
	setVaultPrompt(null);
});
afterEach(async () => {
	vi.unstubAllGlobals();
	await lockVault();
});

describe("let agents use a secret", () => {
	it("turns it on for a shared value with hosts, then off", async () => {
		const user = userEvent.setup();
		const { calls } = renderStaging([], null);
		await openStaging(user);
		const off = await toggle("token");
		// It opens a dialog either way; its name says whether it is on.
		expect(off).toHaveAccessibleName("Let agents use token: off. Choose hosts");
		expect(off).toHaveAttribute("aria-haspopup", "dialog");
		expect(off).not.toHaveAttribute("aria-pressed");
		await user.click(off);
		const dialog = await screen.findByRole("dialog", {
			name: "Let agents use a secret",
		});
		expect(within(dialog).getByText("Only your own agents")).toBeVisible();
		// Prefilled from the scope's base URL.
		expect(hostsBox()).toHaveValue("staging.test");
		await user.type(hostsBox(), "{Enter}api.example.com");
		await user.click(
			within(dialog).getByRole("button", { name: /^Let agents use$/ }),
		);
		await waitFor(() =>
			expect(bodyOf(sent(calls, "PUT", `${USES}/token`)[0])).toEqual({
				hosts: ["staging.test", "api.example.com"],
			}),
		);
		const on = await screen.findByRole("button", {
			name: "Let agents use token: on for staging.test, api.example.com. Edit hosts",
		});
		expect(on).toHaveTextContent("staging.test +1");
		// No local value: nothing is copied for agents.
		expect(sent(calls, "PATCH", LOCAL)).toEqual([]);

		await user.click(
			screen.getByRole("button", { name: "More actions for token" }),
		);
		await user.click(
			await screen.findByRole("menuitem", { name: "Stop letting agents use" }),
		);
		await waitFor(() =>
			expect(sent(calls, "DELETE", `${USES}/token`)).toHaveLength(1),
		);
		expect(await toggle("token")).toHaveAccessibleName(/: off\./);
	});

	it("checks hosts as typed and puts a refused host back on its line", async () => {
		const user = userEvent.setup();
		const { calls } = renderStaging([], null);
		await openStaging(user);
		await user.click(await toggle("token"));
		const dialog = await screen.findByRole("dialog");
		const confirm = within(dialog).getByRole("button", {
			name: /^Let agents use$/,
		});
		await user.clear(hostsBox());
		await user.type(
			hostsBox(),
			"https://x.example.com{Enter}*.com{Enter}x.example.com{Enter}x.example.com",
		);
		const errors = within(dialog).getAllByRole("listitem");
		expect(errors.map((item) => item.textContent)).toEqual(
			expect.arrayContaining([
				"Line 1 (https://x.example.com): enter the host only, without https://, a port or a path",
				expect.stringContaining("Line 2 (*.com): too broad"),
				"Line 4 (x.example.com): same as line 3",
			]),
		);
		expect(hostsBox()).toHaveAttribute("aria-invalid", "true");
		expect(confirm).toBeDisabled();

		agentServer.refuse = "mock.example.com";
		await user.clear(hostsBox());
		await user.type(hostsBox(), "api.example.com{Enter}mock.example.com");
		await user.click(confirm);
		expect(
			await within(dialog).findByText(
				/^Line 2 \(mock\.example\.com\): secrets are never sent to .+ hosts$/,
			),
		).toBeVisible();
		expect(sent(calls, "PUT", `${USES}/token`)).toHaveLength(1);
		expect(confirm).toBeDisabled();
		expect(screen.getByRole("dialog")).toBeVisible();
	});
});
