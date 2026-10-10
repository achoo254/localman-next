import type { Command } from "commander";
import {
	approveLink,
	getApiBaseUrl,
	listLinks,
	revokeLink,
} from "./api-client.js";
import { loadConfig } from "./config.js";
import { printServerMigration, resolveServerUrl } from "./server-url.js";

const NOT_NEEDED =
	"Not needed: you are signed in, so Localman sees this machine's tunnels through your account.";

/** Names come from the server; never let them drive the terminal. */
function printable(text: string): string {
	// biome-ignore lint/suspicious/noControlCharactersInRegex: stripping them is the point
	return text.replace(/[\u0000-\u001f\u007f-\u009f]/g, "");
}

function fail(message: string): never {
	console.error(`  ${message}`);
	process.exit(1);
}

/**
 * Links are for machines without an account: they need the anonymous token
 * saved by an older CLI or `tunelo login --legacy-key`.
 */
function anonymousContext(): { baseUrl: string; key: string } {
	const config = loadConfig();
	if (config.session) {
		console.log(`  ${NOT_NEEDED}`);
		process.exit(0);
	}
	const key = process.env.TUNELO_KEY ?? config.key;
	if (!key) fail("No anonymous token on this machine. Run `tunelo login`.");
	return {
		baseUrl: getApiBaseUrl(resolveServerUrl(undefined, printServerMigration)),
		key,
	};
}

export function registerLinkCommands(program: Command): void {
	program
		.command("link <code>")
		.description("Let Localman see this machine's tunnels (no account needed)")
		.action(async (code: string) => {
			const { baseUrl, key } = anonymousContext();
			try {
				const { clientName } = await approveLink(baseUrl, key, code);
				console.log(
					`  ✓ Linked ${printable(clientName) || "the client"} to this machine.`,
				);
			} catch (err) {
				fail((err as Error).message);
			}
		});

	const links = program
		.command("links")
		.description("List or revoke the links of this machine");

	links
		.command("list", { isDefault: true })
		.description("List the clients linked to this machine")
		.action(async () => {
			const { baseUrl, key } = anonymousContext();
			try {
				const rows = await listLinks(baseUrl, key);
				if (rows.length === 0) {
					console.log("  No links.");
					return;
				}
				for (const row of rows) {
					const used = row.lastUsedAt ? `, last used ${row.lastUsedAt}` : "";
					console.log(
						`  ${printable(row.id)}  ${printable(row.clientName) || "(unnamed)"}  linked ${row.createdAt ?? "?"}${used}`,
					);
				}
			} catch (err) {
				fail((err as Error).message);
			}
		});

	links
		.command("revoke <id>")
		.description("Revoke one link")
		.action(async (id: string) => {
			const { baseUrl, key } = anonymousContext();
			try {
				await revokeLink(baseUrl, key, id);
				console.log("  ✓ Link revoked.");
			} catch (err) {
				fail((err as Error).message);
			}
		});
}
