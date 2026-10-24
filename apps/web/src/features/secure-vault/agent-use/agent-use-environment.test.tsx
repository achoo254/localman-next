import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type FetchCall, mockFetch } from "../../../test/mock-fetch";
import {
	ENV_FLAGS,
	ENV_PATH,
	LIST,
	environment,
	openStaging,
	renderEnvironments,
	summary,
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

const FLAGS = { ...ENV_FLAGS, secretVault: true };
const VAULT_PATH = "/api/v1/users/me/secret-vault";
const USES = "/api/v1/agent-secret-uses/environment/e1";
const LOCAL = `${ENV_PATH}/local-values`;
const LOCKED_PARAMS = {
	salt: "A".repeat(22),
	iterations: 600_000,
	check: `lmv1:${"B".repeat(60)}`,
};

/** A host the server refuses as one of its own, when set. */
const server = { refuse: "" };

type Body = { hosts?: string[]; values?: Record<string, unknown>[] };
const bodyOf = (call: FetchCall | undefined): Body =>
	(call?.body ?? {}) as Body;
const sent = (calls: FetchCall[], method: string, path: string) =>
	calls.filter((call) => call.method === method && call.path === path);

function renderStaging(
	localValues: { key: string; value: string }[],
	vault: unknown,
	uses: { key: string; hosts: string[] }[] = [],
) {
	return renderEnvironments(
		{
			[`GET ${LIST}`]: { body: { items: [summary()] } },
			[`GET ${ENV_PATH}`]: {
				body: environment({
					variables: [
						variable("baseUrl", "https://staging.test/v1"),
						variable("token", "s3cret", { type: "secret" }),
					],
					localValues,
				}),
			},
			[`GET ${VAULT_PATH}`]: { body: { vault } },
			[`GET ${USES}`]: { body: { uses } },
			[`PUT ${USES}/token`]: ({ body }) =>
				server.refuse
					? {
							status: 400,
							body: {
								error: {
									code: "AGENT_HOST_NOT_ALLOWED",
									message: "no",
									details: { hosts: server.refuse },
								},
							},
						}
					: { body: { key: "token", hosts: (body as Body).hosts } },
			[`DELETE ${USES}/token`]: { body: { removed: true } },
			[`PATCH ${LOCAL}`]: ({ body }) => ({
				body: {
					localValues: ((body as Body).values ?? []).map((value) => ({
						key: value.key,
						value: value.value,
						agentUse: typeof value.agentValue === "string",
					})),
				},
			}),
		},
		{ flags: FLAGS },
	);
}

const toggle = (name: string) =>
	screen.findByRole("button", { name: new RegExp(`^Let agents use ${name}`) });
const hostsBox = () => screen.getByRole("textbox", { name: /Allowed hosts/ });

beforeEach(() => {
	server.refuse = "";
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
		expect(off).toHaveAttribute("aria-pressed", "false");
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
		expect(on).toHaveAttribute("aria-pressed", "true");
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
		expect(await toggle("token")).toHaveAttribute("aria-pressed", "false");
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

		server.refuse = "mock.example.com";
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

	it("disables it for a local value while the vault is locked", async () => {
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
	});

	it("copies a local vault value for agents, and again when it changes", async () => {
		const user = userEvent.setup();
		mockFetch({
			[`PUT ${VAULT_PATH}`]: ({ body }) => ({ body: { vault: body } }),
		});
		await createNewVault("correct horse battery");
		const key = vaultKey();
		if (!key) throw new Error("no vault key");
		const cipher = await sealValue(
			key,
			"mine",
			valueAad(environmentScope("e1"), "token"),
		);
		vi.unstubAllGlobals();
		const { calls } = renderStaging([{ key: "token", value: cipher }], null);
		await openStaging(user);
		await waitFor(() =>
			expect(screen.getByLabelText("Local value of token")).toHaveValue("mine"),
		);
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

		await user.type(screen.getByLabelText("Local value of token"), "2");
		await waitFor(() => expect(sent(calls, "PATCH", LOCAL)).toHaveLength(2), {
			timeout: 3000,
		});
		const [next] = bodyOf(sent(calls, "PATCH", LOCAL)[1]).values ?? [];
		expect(next).toMatchObject({ key: "token", agentValue: "mine2" });
		expect(next?.value).not.toBe("mine2");
	});
});
