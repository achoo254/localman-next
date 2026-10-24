import type { ResolverLayer } from "@localman/shared/api-client";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../components/ui/toast";
import { FeaturesContext, NO_FEATURES } from "../../config/features";
import { mockFetch } from "../../test/mock-fetch";
import {
	resetVaultSession,
	setVaultPrompt,
} from "../secure-vault/vault-session";
import { VariableCard } from "./variable-card";

const LAYERS: ResolverLayer[] = [
	{
		kind: "environment",
		label: "Staging",
		variables: [
			{
				key: "token",
				value: null,
				enabled: true,
				secret: true,
				source: "none",
				withheld: true,
				locked: true,
			},
		],
	},
];

const VAULT_ON = {
	...NO_FEATURES,
	apiClient: true,
	workspaces: true,
	environments: true,
	secretVault: true,
};

function card(flags = VAULT_ON) {
	const onDone = vi.fn();
	render(
		<FeaturesContext value={flags}>
			<ToastProvider>
				<VariableCard
					name="token"
					kind="resolved"
					layers={LAYERS}
					choices={[]}
					apply={vi.fn(async () => undefined)}
					onDone={onDone}
				/>
			</ToastProvider>
		</FeaturesContext>,
	);
	return { onDone };
}

const prompt = vi.fn(async () => false);

beforeEach(() => {
	resetVaultSession();
	prompt.mockClear();
	setVaultPrompt(prompt);
	mockFetch({
		"GET /api/v1/users/me/secret-vault": {
			body: {
				vault: {
					salt: "A".repeat(22),
					iterations: 600_000,
					check: `lmv1:${"B".repeat(60)}`,
				},
			},
		},
	});
});
afterEach(() => {
	setVaultPrompt(null);
	vi.unstubAllGlobals();
});

describe("hover card of a value locked in the vault", () => {
	it("says a send using it stops, and offers to unlock", async () => {
		const user = userEvent.setup();
		const { onDone } = card();
		expect(screen.getByText("Locked")).toBeVisible();
		expect(
			document.querySelector('[data-id="var-tooltip-locked"]'),
		).toHaveTextContent(
			"Your local value of this secret (Environment · Staging) is in the locked vault. Requests using {{token}} stop without sending until you unlock it.",
		);
		await user.click(screen.getByRole("button", { name: "Unlock vault" }));
		expect(onDone).toHaveBeenCalled();
		await waitFor(() => expect(prompt).toHaveBeenCalledWith("unlock"));
	});

	it("keeps the plain card with the flag off", () => {
		card({ ...VAULT_ON, secretVault: false });
		expect(screen.queryByRole("button", { name: "Unlock vault" })).toBeNull();
		expect(
			document.querySelector('[data-id="var-tooltip-current"]'),
		).toHaveTextContent("Locked in the vault");
	});
});
