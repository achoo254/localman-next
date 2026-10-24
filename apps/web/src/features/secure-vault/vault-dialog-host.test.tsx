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
import { VaultDialogHost } from "./vault-dialog-host";
import {
	VaultLockedError,
	lockVault,
	requireVaultKey,
	resetVaultSession,
	vaultState,
} from "./vault-session";
import {
	renderVault,
	resetVaultServer,
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

const OLD = "correct horse battery";
const NEW = "purple monkey dishwasher";
let params: SecretVaultParams;

beforeAll(async () => {
	({ params } = await createVault(OLD));
});
beforeEach(() => {
	resetVaultSession();
});
afterEach(async () => {
	await lockVault();
});

/** The host around a "Save" button that needs the key, as the editor does. */
function renderHost() {
	const result: { key?: Promise<CryptoKey> } = {};
	renderVault(
		<VaultDialogHost>
			<button
				type="button"
				onClick={() => {
					result.key = requireVaultKey();
					// Asserted later; marked handled so a rejection is not reported early.
					result.key.catch(() => undefined);
				}}
			>
				Save
			</button>
		</VaultDialogHost>,
	);
	return result;
}

async function askForKey() {
	const result = renderHost();
	const save = screen.getByRole("button", { name: "Save" });
	await userEvent.click(save);
	const key = result.key;
	if (!key) throw new Error("no prompt");
	return { key, save };
}

async function fillCreate(passphrase: string) {
	await userEvent.type(screen.getByLabelText("Passphrase"), passphrase);
	await userEvent.type(screen.getByLabelText("Repeat passphrase"), passphrase);
	await userEvent.click(screen.getByRole("checkbox"));
	await userEvent.click(screen.getByRole("button", { name: "Create vault" }));
}

describe("VaultDialogHost prompt", () => {
	it("creates a vault on demand and resolves with the key", async () => {
		resetVaultServer(null);
		const { key } = await askForKey();
		expect(
			await screen.findByRole("dialog", { name: "Create secret vault" }),
		).toBeVisible();
		await fillCreate(NEW);
		await expect(key).resolves.toBeInstanceOf(CryptoKey);
		expect(
			await screen.findByText("Vault created. It is unlocked on this device."),
		).toBeVisible();
		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("rejects when the person cancels, and gives focus back", async () => {
		resetVaultServer(params);
		const { key, save } = await askForKey();
		expect(
			await screen.findByRole("dialog", { name: "Unlock secret vault" }),
		).toBeVisible();
		await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
		await expect(key).rejects.toBeInstanceOf(VaultLockedError);
		await waitFor(() => expect(save).toHaveFocus());
	});

	it("goes forgot → reset → create and still resolves the ask", async () => {
		resetVaultServer(params);
		vaultServer.deleted = 3;
		const { key } = await askForKey();
		await userEvent.click(
			await screen.findByRole("button", { name: "Forgot passphrase?" }),
		);
		const reset = await screen.findByRole("dialog", {
			name: "Reset secret vault",
		});
		expect(reset).toHaveTextContent(
			"Copies you let agents use are deleted too",
		);
		const confirm = screen.getByRole("button", {
			name: "Delete and start over",
		});
		expect(confirm).toBeDisabled();
		await userEvent.type(
			screen.getByLabelText("Type reset to confirm"),
			"reset",
		);
		await userEvent.click(confirm);

		expect(
			await screen.findByRole("dialog", { name: "Create a new vault" }),
		).toBeVisible();
		expect(vaultServer.resets).toBe(1);
		expect(
			screen.getByText("Old vault deleted with 3 local values."),
		).toBeVisible();
		await fillCreate(NEW);
		await expect(key).resolves.toBeInstanceOf(CryptoKey);
		expect(vaultState().status).toBe("unlocked");
	});

	it("stops asking once unmounted", async () => {
		resetVaultServer(null);
		const { unmount } = renderVault(
			<VaultDialogHost>
				<span />
			</VaultDialogHost>,
		);
		unmount();
		await expect(requireVaultKey()).rejects.toBeInstanceOf(VaultLockedError);
	});
});
