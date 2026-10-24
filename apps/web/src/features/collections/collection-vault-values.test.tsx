import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	ACTIVE,
	EMPTY_GLOBALS,
	ENV_FLAGS,
	GLOBALS,
	LIST,
} from "../environments/environments-test-utils";
import {
	resetVaultSession,
	setVaultPrompt,
} from "../secure-vault/vault-session";
import {
	LIST_PATH,
	detail,
	findRow,
	renderWorkbenchPage,
	summary,
} from "./collections-test-utils";

const LOCAL_PATH = "/api/v1/collections/c1/local-values";
const USES = "/api/v1/agent-secret-uses/collection/c1";
const SHOP = detail("c1", [], {
	name: "Shop",
	variables: [
		{ key: "baseUrl", value: "https://shop.example.com" },
		{ key: "token", value: "s3cret", secret: true },
	],
});
const PARAMS = {
	salt: "A".repeat(22),
	iterations: 600_000,
	check: `lmv1:${"B".repeat(60)}`,
};

function renderShop(local: { key: string; value: string }[]) {
	return renderWorkbenchPage(
		{
			[`GET ${LIST_PATH}`]: {
				body: { items: [summary("c1", { name: "Shop" })] },
			},
			"GET /api/v1/collections/c1": { body: SHOP },
			[`GET ${LIST}`]: { body: { items: [] } },
			[`GET ${ACTIVE}`]: {
				body: { workspaceId: "w-team", environmentId: null },
			},
			[`GET ${GLOBALS}`]: { body: EMPTY_GLOBALS },
			[`GET ${LOCAL_PATH}`]: { body: { localValues: local } },
			"GET /api/v1/users/me/secret-vault": { body: { vault: PARAMS } },
			[`GET ${USES}`]: { body: { uses: [] } },
			[`PUT ${USES}/token`]: ({ body }) => ({
				body: { key: "token", ...(body as { hosts: string[] }) },
			}),
		},
		{ flags: { ...ENV_FLAGS, secretVault: true } },
	);
}

async function openVariables() {
	const user = userEvent.setup();
	await user.click(await findRow("c1"));
	await user.click(await screen.findByRole("tab", { name: "Variables" }));
	return user;
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

describe("secret collection variables and the vault", () => {
	it("shows a locked own value with its unlock action", async () => {
		renderShop([{ key: "token", value: `lmv1:${"A".repeat(60)}` }]);
		const user = await openVariables();
		const cell = await screen.findByRole("button", {
			name: "Local value of token is locked. Unlock the vault to view it",
		});
		expect(
			document.querySelector('[data-id="var-table-vault-notice"]'),
		).toHaveTextContent("1 local value of a secret variable is hidden");
		// The local value needs the vault: "Let agents use" says so.
		expect(
			screen.getByRole("button", { name: "Let agents use token" }),
		).toHaveAttribute("aria-disabled", "true");
		await user.click(cell);
		await waitFor(() => expect(prompt).toHaveBeenCalledWith("unlock"));
	});

	it("lets agents use the shared value for the listed hosts", async () => {
		const { calls } = renderShop([]);
		const user = await openVariables();
		await user.click(
			await screen.findByRole("button", { name: "Let agents use token" }),
		);
		const dialog = await screen.findByRole("dialog");
		expect(
			within(dialog).getByRole("textbox", { name: /Allowed hosts/ }),
		).toHaveValue("shop.example.com");
		await user.click(
			within(dialog).getByRole("button", { name: /^Let agents use$/ }),
		);
		await waitFor(() =>
			expect(
				calls.find((c) => c.method === "PUT" && c.path === `${USES}/token`)
					?.body,
			).toEqual({ hosts: ["shop.example.com"] }),
		);
		expect(
			await screen.findByRole("button", {
				name: "Let agents use token: on for shop.example.com. Edit hosts",
			}),
		).toHaveAttribute("aria-pressed", "true");
	});
});
