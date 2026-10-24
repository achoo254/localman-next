import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../lib/api-client";
import { VaultCreateDialog } from "./vault-create-dialog";
import { lockVault, resetVaultSession, vaultState } from "./vault-session";
import {
	renderVault,
	resetVaultServer,
	serverError,
	vaultServer,
} from "./vault-test-support";

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

function renderCreate(afterReset = false) {
	const onCreated = vi.fn();
	const onCancel = vi.fn();
	const onExists = vi.fn();
	renderVault(
		<VaultCreateDialog
			open
			afterReset={afterReset}
			onCancel={onCancel}
			onCreated={onCreated}
			onExists={onExists}
			onCloseAutoFocus={() => undefined}
		/>,
	);
	return { onCreated, onCancel, onExists };
}

const passphrase = () => screen.getByLabelText("Passphrase");
const confirm = () => screen.getByLabelText("Repeat passphrase");
const ack = () => screen.getByRole("checkbox");
const submit = () => screen.getByRole("button", { name: "Create vault" });

beforeEach(() => {
	resetVaultSession();
	resetVaultServer(null);
});
afterEach(async () => {
	await lockVault();
});

describe("VaultCreateDialog", () => {
	it("focuses the passphrase and keeps submit off until all is valid", async () => {
		renderCreate();
		await waitFor(() => expect(passphrase()).toHaveFocus());
		expect(submit()).toBeDisabled();
		expect(screen.getByText("At least 8 characters")).toBeVisible();

		await userEvent.type(passphrase(), "short");
		expect(screen.getByText("Too short: at least 8 characters")).toBeVisible();
		await userEvent.type(confirm(), "short");
		await userEvent.click(ack());
		expect(submit()).toBeDisabled();
	});

	it("rates the passphrase and flags a second entry that goes another way", async () => {
		renderCreate();
		await userEvent.type(passphrase(), PASSPHRASE);
		expect(screen.getByText("Strong")).toBeVisible();
		expect(passphrase()).toHaveAccessibleDescription("Strong");

		// A prefix of the passphrase is still being typed: no error yet.
		await userEvent.type(confirm(), "correct");
		expect(confirm()).not.toHaveAttribute("aria-invalid");
		await userEvent.type(confirm(), "X");
		expect(confirm()).toHaveAttribute("aria-invalid", "true");
		expect(confirm()).toHaveAccessibleDescription(
			"The two passphrases don't match",
		);
	});

	it("needs the acknowledgement, then creates the vault", async () => {
		const { onCreated } = renderCreate();
		await userEvent.type(passphrase(), PASSPHRASE);
		await userEvent.type(confirm(), PASSPHRASE);
		expect(submit()).toBeDisabled();
		expect(
			screen.getByText("Forget the passphrase and the values are gone"),
		).toBeVisible();
		await userEvent.click(ack());
		expect(submit()).toBeEnabled();

		await userEvent.click(submit());
		await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
		expect(vaultState().status).toBe("unlocked");
		expect(vaultServer.params?.iterations).toBe(600_000);
	});

	it("shows the server's error and keeps what was typed", async () => {
		vaultServer.saveError = serverError("The vault is not available.");
		const { onCreated } = renderCreate();
		await userEvent.type(passphrase(), PASSPHRASE);
		await userEvent.type(confirm(), PASSPHRASE);
		await userEvent.click(ack());
		await userEvent.click(submit());
		expect(
			await screen.findByText("The vault is not available."),
		).toBeVisible();
		expect(onCreated).not.toHaveBeenCalled();
		expect(passphrase()).toHaveValue(PASSPHRASE);
		expect(submit()).toBeEnabled();
	});

	it("turns to unlocking when the account has a vault already", async () => {
		const existing = {
			salt: "A".repeat(22),
			iterations: 600_000,
			check: `lmv1:${"B".repeat(60)}`,
		};
		vaultServer.saveError = new ApiError(409, "SECRET_VAULT_EXISTS", "exists");
		const { onCreated, onExists } = renderCreate();
		await userEvent.type(passphrase(), PASSPHRASE);
		await userEvent.type(confirm(), PASSPHRASE);
		await userEvent.click(ack());
		vaultServer.params = existing;
		await userEvent.click(submit());
		await waitFor(() => expect(onExists).toHaveBeenCalledTimes(1));
		expect(onCreated).not.toHaveBeenCalled();
		// Read again: the unlock dialog has the vault to open.
		expect(vaultState()).toEqual({ status: "locked", params: existing });
	});

	it("shows and hides the passphrase", async () => {
		renderCreate();
		expect(passphrase()).toHaveAttribute("type", "password");
		const [toggle] = screen.getAllByRole("button", { name: "Show passphrase" });
		if (!toggle) throw new Error("no toggle");
		await userEvent.click(toggle);
		expect(passphrase()).toHaveAttribute("type", "text");
		expect(toggle).toHaveAttribute("aria-pressed", "true");
		expect(toggle).toHaveAccessibleName("Hide passphrase");
	});

	it("says the old vault went when it follows a reset", () => {
		renderCreate(true);
		expect(
			screen.getByRole("dialog", { name: "Create a new vault" }),
		).toBeVisible();
		expect(screen.getByText(/The old vault is gone/)).toBeVisible();
	});
});
