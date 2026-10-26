import { expect, test } from "@playwright/test";
import {
	echoBody,
	newRequestTab,
	openApiClient,
	send,
	setUrl,
} from "../support/api-client-ui.js";
import { watchApiTraffic } from "../support/api-traffic.js";
import { ECHO_ORIGIN } from "../support/ports.js";
import {
	environmentWithVaultSecret,
	unlockVault,
} from "../support/secret-vault-ui.js";
import { signIn, uniqueSuffix, uniqueUsername } from "../support/session.js";

/**
 * "Secrets never leave the browser": the own value of a secret is sealed
 * in the browser with the vault's passphrase. Saving it, sending a request
 * that uses it straight from the browser and recording that request in
 * history never hand it to Localman; another device of the same account
 * gets only the ciphertext until the passphrase opens it there.
 */
test("a secret's own value stays in the browser and opens on another device only with the passphrase @smoke", async ({
	page,
	browser,
}) => {
	const suffix = uniqueSuffix();
	const username = uniqueUsername("vault", suffix);
	const secret = `vault-${suffix}-value`;
	await signIn(page, username);
	const traffic = watchApiTraffic(page);
	await openApiClient(page);
	await environmentWithVaultSecret(page, "token", secret);

	// The secret in the path and the query of a request sent directly.
	await newRequestTab(page);
	await setUrl(page, `${ECHO_ORIGIN}/cors/keys/{{token}}?key={{token}}`);
	const recorded = page.waitForResponse(
		(response) =>
			response.request().method() === "POST" &&
			new URL(response.url()).pathname.endsWith("/history"),
	);
	await send(page);
	await expect(page.getByTestId("response-status")).toContainText("200");
	expect((await echoBody(page)).url).toBe(`/cors/keys/${secret}?key=${secret}`);
	await recorded;

	expect(await traffic.carrying(secret)).toEqual([]);
	expect(traffic.paths().some((path) => path.includes("/proxy"))).toBe(false);

	// Another device of the account: the value is there, locked.
	const other = await browser.newContext();
	try {
		const device = await other.newPage();
		await signIn(device, username);
		const deviceTraffic = watchApiTraffic(device);
		await openApiClient(device);
		await device.getByTestId("sidebar-rail-environments").click();
		await device.getByTestId("sidebar-envs-item-open").first().click();
		const editor = device.getByTestId("environment-editor");
		const locked = editor.getByTestId("var-table-value-locked");
		await expect(locked).toBeVisible();
		await expect(device.getByTestId("app-header-vault")).toHaveAttribute(
			"data-vault",
			"locked",
		);
		expect(await deviceTraffic.carrying(secret)).toEqual([]);

		// The passphrase opens it on this device too.
		await locked.click();
		await unlockVault(device);
		await expect(editor.getByTestId("var-table-value").last()).toHaveValue(
			secret,
		);
		expect(await deviceTraffic.carrying(secret)).toEqual([]);
	} finally {
		await other.close();
	}
});
