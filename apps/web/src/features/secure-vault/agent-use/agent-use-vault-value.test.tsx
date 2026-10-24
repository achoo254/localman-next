import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockFetch } from "../../../test/mock-fetch";
import {
	openStaging,
	variable,
} from "../../environments/environments-test-utils";
import { environmentScope } from "../vault-codec";
import { sealValue, valueAad } from "../vault-crypto";
import {
	createNewVault,
	lockVault,
	resetVaultSession,
	setVaultPrompt,
	vaultKey,
} from "../vault-session";
import {
	LOCAL,
	LOCKED_PARAMS,
	VAULT_PATH,
	bodyOf,
	renderStaging,
	sent,
	toggle,
} from "./agent-use-test-support";

/** An open vault on this device, and `plain` sealed as `token` of e1. */
async function openVaultWith(plain: string): Promise<string> {
	mockFetch({
		[`PUT ${VAULT_PATH}`]: ({ body }) => ({ body: { vault: body } }),
	});
	await createNewVault("correct horse battery");
	vi.unstubAllGlobals();
	const key = vaultKey();
	if (!key) throw new Error("no vault key");
	return sealValue(key, plain, valueAad(environmentScope("e1"), "token"));
}

const tokenBox = () => screen.getByLabelText("Local value of token");
const nameBox = (row: number) =>
	screen.getByRole("textbox", { name: `Name of row ${row}` });

beforeEach(() => {
	resetVaultSession();
	setVaultPrompt(null);
});
afterEach(async () => {
	vi.unstubAllGlobals();
	await lockVault();
});

describe("let agents use a vault value", () => {
	it("is disabled for a local value while the vault is locked", async () => {
		const user = userEvent.setup();
		renderStaging(
			[{ key: "token", value: `lmv1:${"A".repeat(60)}` }],
			LOCKED_PARAMS,
		);
		await openStaging(user);
		const control = await toggle("token");
		await waitFor(() =>
			expect(control).toHaveAttribute("aria-disabled", "true"),
		);
		await user.click(control);
		expect(
			await screen.findByText(
				"Unlock the secret vault to change Let agents use for your local value.",
			),
		).toBeVisible();
		expect(screen.queryByRole("dialog")).toBeNull();
		// Renaming would strand the locked value: the name stays as it is.
		expect(nameBox(2)).toHaveAttribute("readonly");
		expect(nameBox(2)).toHaveAttribute(
			"title",
			"Unlock the secret vault to rename it: its local value is locked.",
		);
	});

	it("copies a local vault value for agents, and again when it changes", async () => {
		const user = userEvent.setup();
		const cipher = await openVaultWith("mine");
		const { calls } = renderStaging([{ key: "token", value: cipher }], null);
		await openStaging(user);
		await waitFor(() => expect(tokenBox()).toHaveValue("mine"));
		await user.click(await toggle("token"));
		const dialog = await screen.findByRole("dialog");
		expect(
			within(dialog).getByText(
				"Your local value no longer stays only in this browser",
			),
		).toBeVisible();
		await user.click(
			within(dialog).getByRole("button", { name: /^Let agents use$/ }),
		);
		await waitFor(() => expect(sent(calls, "PATCH", LOCAL)).toHaveLength(1));
		const [copy] = bodyOf(sent(calls, "PATCH", LOCAL)[0]).values ?? [];
		expect(copy).toEqual({
			key: "token",
			value: expect.stringMatching(/^lmv1:/),
			agentValue: "mine",
		});
		await screen.findByRole("button", { name: /^Let agents use token: on/ });
		// Renaming would drop the hosts with the old name: blocked, said why.
		expect(nameBox(2)).toHaveAttribute("readonly");

		await user.type(tokenBox(), "2");
		await waitFor(() => expect(sent(calls, "PATCH", LOCAL)).toHaveLength(2), {
			timeout: 3000,
		});
		const [next] = bodyOf(sent(calls, "PATCH", LOCAL)[1]).values ?? [];
		expect(next).toMatchObject({ key: "token", agentValue: "mine2" });
		expect(next?.value).not.toBe("mine2");
	});

	it("keeps the copy the server has even before the uses load", async () => {
		const user = userEvent.setup();
		const cipher = await openVaultWith("mine");
		const { calls } = renderStaging(
			[{ key: "token", value: cipher, agentUse: true }],
			null,
		);
		// The uses listed do not name it: the server's word on the value counts.
		await openStaging(user);
		await waitFor(() => expect(tokenBox()).toHaveValue("mine"));
		await user.type(tokenBox(), "!");
		await waitFor(() => expect(sent(calls, "PATCH", LOCAL)).toHaveLength(1), {
			timeout: 3000,
		});
		const [write] = bodyOf(sent(calls, "PATCH", LOCAL)[0]).values ?? [];
		expect(write).toMatchObject({ key: "token", agentValue: "mine!" });
	});

	it("seals a value typed right after switching a variable to secret", async () => {
		const user = userEvent.setup();
		await openVaultWith("unused");
		const { calls } = renderStaging([], null, [], [variable("apiKey", "")]);
		await openStaging(user);
		await user.selectOptions(
			screen.getByRole("combobox", { name: "Type of apiKey" }),
			"secret",
		);
		await user.type(screen.getByLabelText("Local value of apiKey"), "k3y");
		await waitFor(() => expect(sent(calls, "PATCH", LOCAL)).toHaveLength(1), {
			timeout: 3000,
		});
		const [write] = bodyOf(sent(calls, "PATCH", LOCAL)[0]).values ?? [];
		expect(write?.key).toBe("apiKey");
		expect(write?.value).toMatch(/^lmv1:/);
	});
});
