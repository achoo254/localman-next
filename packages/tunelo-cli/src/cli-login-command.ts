import type { Command } from "commander";
import { getApiBaseUrl, verifyKey } from "./api-client.js";
import { type StoredSession, loadConfig, updateConfig } from "./config.js";
import {
	deviceNameForIdp,
	pollForTokens,
	startDeviceAuthorization,
} from "./device-login.js";
import { discover, idpIssuer, revokeToken } from "./idp-client.js";
import { clearSession, saveSession, sessionFromTokens } from "./idp-session.js";
import { openBrowser } from "./open-browser.js";
import { printServerMigration, resolveServerUrl } from "./server-url.js";

function fail(message: string): never {
	console.error(`  ${message}`);
	process.exit(1);
}

/** `--legacy-key`: CI without a browser keeps using an anonymous token. */
async function saveLegacyKey(key: string): Promise<void> {
	const baseUrl = getApiBaseUrl(
		resolveServerUrl(undefined, printServerMigration),
	);
	const result = await verifyKey(baseUrl, key).catch((err: Error) =>
		fail(`Could not reach the server: ${err.message}`),
	);
	if (!result.valid || result.kind !== "legacy") {
		fail("That token is not a valid anonymous access token.");
	}
	updateConfig((config) => ({ ...config, key }));
	console.log("  ✓ Token verified & saved. Run: tunelo http <port>");
}

async function deviceLogin(): Promise<void> {
	const issuer = idpIssuer();
	const endpoints = await discover(issuer).catch((err: Error) =>
		fail(`Could not reach ${issuer}: ${err.message}`),
	);
	const authorization = await startDeviceAuthorization(
		endpoints,
		deviceNameForIdp(),
	).catch((err: Error) => fail(err.message));

	const url =
		authorization.verificationUriComplete ?? authorization.verificationUri;
	console.log();
	console.log("  Sign in to Tunelo in your browser:");
	console.log(`  ${url}`);
	console.log(`  Confirm the code: ${authorization.userCode}`);
	console.log();
	console.log("  Waiting for approval...");
	await openBrowser(url);

	const tokens = await pollForTokens(endpoints, authorization).catch(
		(err: Error) => fail(err.message),
	);
	const session = sessionFromTokens(issuer, tokens, undefined, Date.now());
	saveSession(session);
	console.log(
		`  ✓ Signed in (account ${session.sub}). Run: tunelo http <port>`,
	);
}

/** Revokes the grant at the IdP; on failure says where to do it by hand. */
async function revokeSession(session: StoredSession): Promise<void> {
	const { issuer, refreshToken } = session;
	try {
		await revokeToken(await discover(issuer), refreshToken);
	} catch (err) {
		console.error(
			`  Could not revoke at ${issuer} (${(err as Error).message}); revoke this machine at ${issuer}/account.`,
		);
	}
}

export function registerLoginCommands(program: Command): void {
	program
		.command("login")
		.description("Sign in with your account (opens the browser)")
		.option(
			"--legacy-key [token]",
			"Save an anonymous access token instead (CI, no browser); without a value it is read from TUNELO_KEY, keeping it out of shell history",
		)
		.option("-f, --force", "Sign in again even if already signed in")
		.action(
			async (options: { legacyKey?: string | boolean; force?: boolean }) => {
				if (options.legacyKey !== undefined) {
					const key =
						typeof options.legacyKey === "string"
							? options.legacyKey
							: process.env.TUNELO_KEY;
					if (!key) fail("Pass the token or set TUNELO_KEY.");
					await saveLegacyKey(key);
					return;
				}
				const existing = loadConfig().session;
				if (existing && !options.force) {
					console.log(
						`  Already signed in (account ${existing.sub}). Use --force to sign in again.`,
					);
					return;
				}
				// Signing in again replaces this machine's grant: end the old one.
				if (existing) await revokeSession(existing);
				await deviceLogin();
			},
		);

	program
		.command("logout")
		.description("Sign out: revoke this machine's sign-in and forget tokens")
		.action(async () => {
			const config = loadConfig();
			if (!config.session && !config.key) {
				console.log("  Not signed in.");
				return;
			}
			if (config.session) {
				await revokeSession(config.session);
				clearSession();
			}
			// Keep deviceId so a later sign-in stays idempotent for this machine.
			updateConfig((current) => ({ ...current, key: undefined }));
			console.log("  Signed out. Tokens removed from this machine.");
		});
}
