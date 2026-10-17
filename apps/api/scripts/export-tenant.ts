/**
 * Writes one tenant's documents for its move to its own servers
 * (hoandat-auth ADR 0007 §7), on the server it moves from:
 *   node --env-file=.env dist/export-tenant.mjs <tenant-id> <migration-key.pub.json> <out-dir>
 * The IdP must have the tenant `migrating` and the tenant's Localman be
 * idle (writes after the export do not move). Secret variable values are
 * sealed again under a key made for this move, itself sealed to the
 * install's migration key: `out-dir` (new, mode 700) opens only there.
 * Prints names and counts, never a value or the Mongo URI.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseEnv } from "../src/config/env.js";
import { connectMongo, disconnectMongo } from "../src/db/connect-mongo.js";
import { createLogger } from "../src/logger.js";
import { TokenCipher, parseKeyring } from "../src/modules/auth/token-cipher.js";
import { createMoveKey, sealMoveKey } from "../src/tenancy/move-key.js";
import { exportTenantData } from "../src/tenancy/tenant-move-data.js";
import { resealWith } from "../src/tenancy/tenant-move.js";
import "../src/db/register-models.js";

async function main(): Promise<void> {
	const [tenantId, publicKeyPath, outDir] = process.argv.slice(2);
	if (!tenantId || !publicKeyPath || !outDir) {
		throw new Error(
			"usage: export-tenant <tenant-id> <migration-key.pub.json> <out-dir>",
		);
	}
	const env = parseEnv(process.env);
	const keyring = env.VARIABLE_ENCRYPTION_KEY
		? parseKeyring(env.VARIABLE_ENCRYPTION_KEY)
		: null;
	if (!keyring) throw new Error("VARIABLE_ENCRYPTION_KEY is not set");
	const installKey: unknown = JSON.parse(await readFile(publicKeyPath, "utf8"));
	const moveKey = createMoveKey(tenantId);
	const sealedKey = await sealMoveKey(moveKey, installKey);
	await mkdir(outDir, { mode: 0o700 });
	await writeFile(join(outDir, "move-key.jwe"), `${sealedKey}\n`, {
		mode: 0o600,
		flag: "wx",
	});
	await connectMongo(env.MONGO_URI, createLogger("warn"));
	try {
		const manifest = await exportTenantData(
			tenantId,
			outDir,
			resealWith(new TokenCipher(keyring), new TokenCipher(moveKey.keyring)),
		);
		for (const { collection, count, unreadable } of manifest.collections) {
			const note =
				unreadable > 0 ? ` (${unreadable} unreadable secret values)` : "";
			process.stdout.write(`${collection}: ${count}${note}\n`);
		}
		process.stdout.write(`Wrote ${tenantId} to ${outDir}\n`);
	} finally {
		await disconnectMongo().catch(() => undefined);
	}
}

main().then(
	() => process.exit(0),
	(error: unknown) => {
		const message = error instanceof Error ? error.message : String(error);
		process.stderr.write(`export-tenant failed: ${message}\n`);
		process.exit(1);
	},
);
