/**
 * Takes a moved tenant's documents into a self-hosted install, where they
 * belong to the install's primary tenant (hoandat-auth ADR 0007 §7):
 *   node --env-file=.env dist/import-tenant.mjs <dir> <migration-key.json>
 * `dir` is what export-tenant wrote. Opens the move key with the install's
 * migration private key and seals secret variable values again with this
 * install's VARIABLE_ENCRYPTION_KEY. Refuses an install that already has
 * data. Prints names and counts, never a value or the Mongo URI.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseEnv } from "../src/config/env.js";
import {
	connectMongo,
	disconnectMongo,
	initModels,
} from "../src/db/connect-mongo.js";
import { createLogger } from "../src/logger.js";
import { TokenCipher, parseKeyring } from "../src/modules/auth/token-cipher.js";
import { openMoveKey } from "../src/tenancy/move-key.js";
import { PRIMARY_TENANT_ID } from "../src/tenancy/primary-tenant.js";
import {
	countMovedData,
	importTenantData,
	readMoveManifest,
} from "../src/tenancy/tenant-move-data.js";
import { resealWith } from "../src/tenancy/tenant-move.js";
import "../src/db/register-models.js";

async function main(): Promise<void> {
	const [dir, keyPath] = process.argv.slice(2);
	if (!dir || !keyPath)
		throw new Error("usage: import-tenant <dir> <migration-key.json>");
	const env = parseEnv(process.env);
	const keyring = env.VARIABLE_ENCRYPTION_KEY
		? parseKeyring(env.VARIABLE_ENCRYPTION_KEY)
		: null;
	if (!keyring) throw new Error("VARIABLE_ENCRYPTION_KEY is not set");
	const privateKey: unknown = JSON.parse(await readFile(keyPath, "utf8"));
	const moveKey = await openMoveKey(
		await readFile(join(dir, "move-key.jwe"), "utf8"),
		privateKey,
	);
	const manifest = await readMoveManifest(dir);
	if (manifest.tenantId !== moveKey.tenantId) {
		throw new Error("the move key and the documents are of different tenants");
	}
	await connectMongo(env.MONGO_URI, createLogger("warn"));
	try {
		await initModels();
		const existing = await countMovedData(PRIMARY_TENANT_ID);
		if (existing > 0) {
			throw new Error(
				`this install already has ${existing} documents; import into a fresh one`,
			);
		}
		const imported = await importTenantData(
			dir,
			PRIMARY_TENANT_ID,
			resealWith(new TokenCipher(moveKey.keyring), new TokenCipher(keyring)),
		);
		for (const { collection, count, unreadable } of imported) {
			const note =
				unreadable > 0 ? ` (${unreadable} unreadable secret values)` : "";
			process.stdout.write(`${collection}: ${count}${note}\n`);
		}
		process.stdout.write(
			`Imported ${moveKey.tenantId} as ${PRIMARY_TENANT_ID}\n`,
		);
	} finally {
		await disconnectMongo().catch(() => undefined);
	}
}

main().then(
	() => process.exit(0),
	(error: unknown) => {
		const message = error instanceof Error ? error.message : String(error);
		process.stderr.write(`import-tenant failed: ${message}\n`);
		process.exit(1);
	},
);
