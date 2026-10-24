import { type Locator, type Page, expect } from "@playwright/test";

/** Long enough for the strength meter; the vault never sends it anywhere. */
export const VAULT_PASSPHRASE = "violet harbour lantern seventy kites";

/** Fills the "Create secret vault" dialog the page shows, then waits it out. */
export async function createVault(page: Page): Promise<void> {
	const dialog = page.getByTestId("modal-vault-create");
	await expect(dialog).toBeVisible();
	await dialog
		.getByTestId("modal-vault-create-passphrase")
		.fill(VAULT_PASSPHRASE);
	await dialog.getByTestId("modal-vault-create-confirm").fill(VAULT_PASSPHRASE);
	await dialog.getByTestId("modal-vault-create-ack").check();
	await dialog.getByTestId("modal-vault-create-submit").click();
	// Deriving the key takes a moment (600 000 PBKDF2 rounds).
	await expect(dialog).toBeHidden({ timeout: 30_000 });
}

/** Fills the unlock dialog the page shows, then waits it out. */
export async function unlockVault(page: Page): Promise<void> {
	const dialog = page.getByTestId("modal-vault-unlock");
	await expect(dialog).toBeVisible();
	await dialog
		.getByTestId("modal-vault-unlock-passphrase")
		.fill(VAULT_PASSPHRASE);
	await dialog.getByTestId("modal-vault-unlock-submit").click();
	await expect(dialog).toBeHidden({ timeout: 30_000 });
}

/**
 * From the environments panel of the API client: a new environment
 * ("New environment", made active) with the secret `key`, whose own value
 * `value` goes into a vault created on the way. Answers the editor.
 */
export async function environmentWithVaultSecret(
	page: Page,
	key: string,
	value: string,
): Promise<Locator> {
	await page.getByTestId("sidebar-rail-environments").click();
	await page.getByTestId("sidebar-envs-create").click();
	const editor = page.getByTestId("environment-editor");
	await expect(editor).toBeVisible();
	await editor.getByTestId("var-table-add").click();
	await editor.getByTestId("var-table-name").last().fill(key);
	await editor.getByTestId("var-table-type").last().selectOption("secret");
	await expect(editor.getByTestId("collection-save-state")).toHaveText(
		"All changes saved",
	);

	// Without a vault the own value of a secret offers to create one.
	await editor.getByTestId("var-table-value-novault").last().click();
	await createVault(page);
	// Own values save on their own, after the table's autosave.
	const sealed = page.waitForResponse(
		(response) =>
			response.request().method() === "PATCH" &&
			new URL(response.url()).pathname.endsWith("/local-values"),
	);
	await editor.getByTestId("var-table-value").last().fill(value);
	expect((await sealed).ok()).toBe(true);
	await editor.getByTestId("environment-header-active").click();
	return editor;
}
