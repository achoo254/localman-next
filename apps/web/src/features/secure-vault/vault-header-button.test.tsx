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
import { VaultHeaderButton } from "./vault-header-button";
import {
	loadVault,
	lockVault,
	resetVaultSession,
	unlockWith,
	vaultState,
} from "./vault-session";
import { renderVault, resetVaultServer } from "./vault-test-support";

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
beforeEach(() => {
	resetVaultSession();
});
afterEach(async () => {
	await lockVault();
});

function renderButton() {
	const view = renderVault(
		<VaultDialogHost>
			<VaultHeaderButton />
		</VaultDialogHost>,
	);
	return {
		...view,
		button: () => screen.getByRole("button", { name: /^Secret vault:/ }),
	};
}

describe("VaultHeaderButton", () => {
	it("stays hidden when the server does not run the vault", async () => {
		resetVaultServer(undefined);
		const { container } = renderButton();
		await waitFor(() => expect(vaultState().status).toBe("off"));
		expect(container.querySelector('[data-id="app-header-vault"]')).toBeNull();
	});

	it("opens the create dialog when there is no vault", async () => {
		resetVaultServer(null);
		renderButton();
		const button = await screen.findByRole("button", {
			name: "Secret vault: No vault",
		});
		expect(button).toHaveAttribute("aria-haspopup", "dialog");
		await userEvent.click(button);
		expect(
			await screen.findByRole("dialog", { name: "Create secret vault" }),
		).toBeVisible();
	});

	it("opens the unlock dialog while locked, and opens the vault", async () => {
		resetVaultServer(params);
		renderButton();
		await userEvent.click(
			await screen.findByRole("button", { name: "Secret vault: Locked" }),
		);
		await userEvent.type(
			await screen.findByLabelText("Passphrase"),
			`${PASSPHRASE}{Enter}`,
		);
		const unlocked = await screen.findByRole("button", {
			name: "Secret vault: Unlocked",
		});
		expect(screen.queryByRole("dialog")).toBeNull();
		// Focus comes back to the button, a menu trigger now.
		await waitFor(() => expect(unlocked).toHaveFocus());
	});

	it("locks from the menu when unlocked", async () => {
		resetVaultServer(params);
		await loadVault();
		await unlockWith(PASSPHRASE);
		const { button } = renderButton();
		await userEvent.click(button());
		await userEvent.click(
			await screen.findByRole("menuitem", { name: "Lock" }),
		);
		await waitFor(() => expect(vaultState().status).toBe("locked"));
		expect(
			await screen.findByRole("button", { name: "Secret vault: Locked" }),
		).toHaveFocus();
		expect(screen.getByText(/^Vault locked\./)).toBeVisible();
	});

	it("opens the reset dialog from the menu", async () => {
		resetVaultServer(params);
		await loadVault();
		await unlockWith(PASSPHRASE);
		const { button } = renderButton();
		await userEvent.click(button());
		const items = (await screen.findAllByRole("menuitem")).map((item) =>
			item.getAttribute("data-id"),
		);
		expect(items).toEqual(["vault-menu-lock", "vault-menu-reset"]);
		await userEvent.click(
			screen.getByRole("menuitem", { name: "Reset vault…" }),
		);
		expect(
			await screen.findByRole("dialog", { name: "Reset secret vault" }),
		).toBeVisible();
		await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
		expect(vaultState().status).toBe("unlocked");
	});
});
