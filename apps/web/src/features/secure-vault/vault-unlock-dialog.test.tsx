import type { SecretVaultParams } from "@localman/shared/api-client";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { createVault } from "./vault-crypto";
import {
	loadVault,
	lockVault,
	resetVaultSession,
	vaultState,
} from "./vault-session";
import { renderVault, resetVaultServer } from "./vault-test-support";
import { VaultUnlockDialog } from "./vault-unlock-dialog";

vi.mock(
	"./vault-api",
	async () => (await import("./vault-test-support")).vaultApiDouble,
);
vi.mock("../auth/use-current-user", () => ({
	peekCurrentUser: () => ({
		status: "authenticated",
		user: { sub: "acc_ada" },
	}),
}));

const PASSPHRASE = "correct horse battery";
let params: SecretVaultParams;

beforeAll(async () => {
	({ params } = await createVault(PASSPHRASE));
});
beforeEach(async () => {
	resetVaultSession();
	resetVaultServer(params);
	await loadVault();
});
afterEach(async () => {
	await lockVault();
});

function renderUnlock() {
	const props = {
		onCancel: vi.fn(),
		onUnlocked: vi.fn(),
		onForgot: vi.fn(),
	};
	renderVault(
		<VaultUnlockDialog open onCloseAutoFocus={() => undefined} {...props} />,
	);
	return props;
}

const field = () => screen.getByLabelText("Passphrase");

describe("VaultUnlockDialog", () => {
	it("asks for the passphrase when nothing is typed", async () => {
		const { onUnlocked } = renderUnlock();
		await waitFor(() => expect(field()).toHaveFocus());
		await userEvent.click(screen.getByRole("button", { name: "Unlock" }));
		expect(field()).toHaveAttribute("aria-invalid", "true");
		expect(field()).toHaveAccessibleDescription("Enter the vault passphrase");
		expect(onUnlocked).not.toHaveBeenCalled();
	});

	it("refuses a wrong passphrase and keeps focus in the field", async () => {
		const { onUnlocked } = renderUnlock();
		await userEvent.type(field(), "wrong horse{Enter}");
		expect(
			await screen.findByText(/^Wrong passphrase\. Check Caps Lock/),
		).toBeVisible();
		expect(field()).toHaveAttribute("aria-invalid", "true");
		expect(field()).toHaveFocus();
		expect(vaultState().status).toBe("locked");
		expect(onUnlocked).not.toHaveBeenCalled();

		// Typing again clears the error.
		await userEvent.type(field(), "x");
		expect(field()).not.toHaveAttribute("aria-invalid");
	});

	it("unlocks with the right passphrase on Enter", async () => {
		const { onUnlocked } = renderUnlock();
		await userEvent.type(field(), `${PASSPHRASE}{Enter}`);
		await waitFor(() => expect(onUnlocked).toHaveBeenCalledTimes(1));
		expect(vaultState().status).toBe("unlocked");
	});

	it("hands over to the reset dialog from 'Forgot passphrase?'", async () => {
		const { onForgot, onCancel } = renderUnlock();
		await userEvent.click(
			screen.getByRole("button", { name: "Forgot passphrase?" }),
		);
		expect(onForgot).toHaveBeenCalledTimes(1);
		await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
		expect(onCancel).toHaveBeenCalledTimes(1);
	});
});
