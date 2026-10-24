import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MockRoute } from "../../test/mock-fetch";
import {
	resetVaultSession,
	setVaultPrompt,
} from "../secure-vault/vault-session";
import {
	ACTIVE,
	ENV_FLAGS,
	ENV_PATH,
	LIST,
	environment,
	openStaging,
	renderEnvironments,
	summary,
	variable,
} from "./environments-test-utils";

const VAULT_FLAGS = { ...ENV_FLAGS, secretVault: true };
const VAULT_PATH = "/api/v1/users/me/secret-vault";
const USES_PATH = "/api/v1/agent-secret-uses/environment/e1";
/** Well formed, but no key on this device opens it. */
const CIPHER = `lmv1:${"A".repeat(60)}`;
const PARAMS = {
	salt: "A".repeat(22),
	iterations: 600_000,
	check: `lmv1:${"B".repeat(60)}`,
};

interface Setup {
	vault?: typeof PARAMS | null;
	localValues?: { key: string; value: string }[];
	flags?: typeof VAULT_FLAGS;
}

function renderStaging(
	{ vault = PARAMS, localValues, flags = VAULT_FLAGS }: Setup = {},
	extra: Record<string, MockRoute> = {},
) {
	const staging = environment({
		variables: [
			variable("baseUrl", "https://staging.test"),
			variable("token", "s3cret", { type: "secret" }),
		],
		localValues: localValues ?? [{ key: "token", value: CIPHER }],
	});
	return renderEnvironments(
		{
			[`GET ${LIST}`]: { body: { items: [summary()] } },
			[`GET ${ENV_PATH}`]: { body: staging },
			[`GET ${VAULT_PATH}`]: { body: { vault } },
			[`GET ${USES_PATH}`]: { body: { uses: [] } },
			...extra,
		},
		{ flags },
	);
}

const prompt = vi.fn(async () => false);

beforeEach(() => {
	resetVaultSession();
	prompt.mockClear();
	setVaultPrompt(prompt);
});
afterEach(() => {
	setVaultPrompt(null);
	vi.unstubAllGlobals();
});

describe("local values locked in the vault", () => {
	it("masks a locked value and offers to unlock it", async () => {
		const user = userEvent.setup();
		renderStaging();
		await openStaging(user);
		const cell = await screen.findByRole("button", {
			name: "Local value of token is locked. Unlock the vault to view it",
		});
		expect(cell).toHaveTextContent("Unlock to view");
		expect(screen.queryByLabelText("Local value of token")).toBeNull();
		const notice = document.querySelector('[data-id="var-table-vault-notice"]');
		expect(notice).toHaveTextContent("Secret vault is locked");
		expect(notice).toHaveTextContent(
			"1 local value of a secret variable is hidden",
		);
		await user.click(cell);
		await waitFor(() => expect(prompt).toHaveBeenCalledWith("unlock"));
		// Cancelling leaves the value locked, with no error.
		expect(cell).toBeInTheDocument();
		expect(screen.queryByRole("alert")).toBeNull();
	});

	it("disables what would read the locked value, with the reason", async () => {
		const user = userEvent.setup();
		renderStaging();
		await openStaging(user);
		await screen.findByRole("button", {
			name: /Local value of token is locked/,
		});
		await user.click(
			screen.getByRole("button", { name: "More actions for token" }),
		);
		const copy = await screen.findByRole("menuitem", { name: /Copy value/ });
		expect(copy).toHaveAttribute("aria-disabled", "true");
		expect(copy).toHaveTextContent("Unlock the secret vault first");
		const update = screen.getByRole("menuitem", {
			name: /Update shared value/,
		});
		expect(update).toHaveAttribute("aria-disabled", "true");
		expect(
			screen.getByRole("menuitem", { name: "Reset value" }),
		).not.toHaveAttribute("aria-disabled");
	});

	it("asks to create a vault before a secret's first local value", async () => {
		const user = userEvent.setup();
		renderStaging({ vault: null, localValues: [] });
		await openStaging(user);
		const cell = await screen.findByRole("button", {
			name: "Set a local value for token: create a secret vault first",
		});
		expect(await screen.findByText("No secret vault yet")).toBeVisible();
		await user.click(screen.getByRole("button", { name: "Create vault" }));
		await waitFor(() => expect(prompt).toHaveBeenCalledWith("create"));
		await user.click(cell);
		expect(prompt).toHaveBeenCalledTimes(2);
		// A plain variable keeps its box.
		expect(
			screen.getByRole("textbox", { name: "Local value of baseUrl" }),
		).toBeEnabled();
	});

	it("says calmly that a secret was not saved when the vault stays closed", async () => {
		const user = userEvent.setup();
		// A value saved before the vault existed is still plain text.
		renderStaging({
			vault: null,
			localValues: [{ key: "token", value: "old" }],
		});
		await openStaging(user);
		const box = await screen.findByLabelText("Local value of token");
		await user.type(box, "!");
		await waitFor(() => expect(prompt).toHaveBeenCalledWith("create"), {
			timeout: 3000,
		});
		expect(
			await screen.findByText(
				"Not saved: the secret vault is locked. Unlock it to save values of secret variables.",
			),
		).toBeVisible();
	});

	it("says a locked value is locked in the quick look", async () => {
		const user = userEvent.setup();
		renderStaging(
			{},
			{
				[`GET ${ACTIVE}`]: {
					body: { workspaceId: "w-team", environmentId: "e1" },
				},
			},
		);
		await user.click(
			await screen.findByRole("button", { name: "Quick look at variables" }),
		);
		const row = await waitFor(() => {
			const found = document.querySelector<HTMLElement>(
				'[data-id="vars-quick-row"][data-key="token"]',
			);
			if (!found) throw new Error("no token row");
			return found;
		});
		await waitFor(() => expect(row).toHaveTextContent("Locked"));
		await user.click(
			within(row).getByRole("button", {
				name: "Local value of token is locked. Unlock the vault to view it",
			}),
		);
		await waitFor(() => expect(prompt).toHaveBeenCalledWith("unlock"));
	});

	it("changes nothing with the flag off", async () => {
		const user = userEvent.setup();
		const { calls } = renderStaging({
			flags: { ...ENV_FLAGS, secretVault: false },
		});
		await openStaging(user);
		// A secret's box is a password field (no textbox role).
		expect(await screen.findByLabelText("Local value of token")).toBeEnabled();
		expect(screen.queryByText("Secret vault is locked")).toBeNull();
		expect(screen.queryByRole("button", { name: /Let agents use/ })).toBeNull();
		expect(
			calls.filter(
				(call) => call.path === VAULT_PATH || call.path === USES_PATH,
			),
		).toEqual([]);
	});
});
