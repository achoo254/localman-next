import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exportJWK, generateKeyPair } from "jose";
import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import "../db/register-models.js";
import { type Keyring, TokenCipher } from "../modules/auth/token-cipher.js";
import { environmentScope } from "../modules/environments/environment-model.js";
import {
	localSlot,
	sharedSlot,
} from "../modules/environments/secret-cipher.js";
import { connectTestMongo } from "../test-support/test-mongo.js";
import { createMoveKey, openMoveKey, sealMoveKey } from "./move-key.js";
import {
	countMovedData,
	exportTenantData,
	importTenantData,
} from "./tenant-move-data.js";
import { resealWith } from "./tenant-move.js";

/*
 * A tenant moving to its own servers (hoandat-auth ADR 0007 §7): its
 * documents leave with secret values sealed to a key made for the move,
 * and arrive as the install's primary tenant, sealed with its keyring.
 */

const MOVING = "ten_MOVINGMOVINGMOVI";
const STAYING = "ten_STAYINGSTAYINGST";
const SECRET = "s3cret-variable-value";

const keyring = (kid: string): Keyring => ({
	activeKid: kid,
	keys: new Map([[kid, randomBytes(32)]]),
});
const shared = new TokenCipher(keyring("shared"));
const install = new TokenCipher(keyring("install"));
const envId = new mongoose.Types.ObjectId();
const raw = (name: string) => mongoose.connection.collection(name);

let teardown: () => Promise<void>;
let dir: string;

beforeAll(async () => {
	teardown = await connectTestMongo();
	dir = await mkdtemp(join(tmpdir(), "tenant-move-"));
	const slot = sharedSlot(environmentScope(envId), "v1");
	await raw("environments").insertOne({
		_id: envId,
		tenantId: MOVING,
		name: "prod",
		variables: [
			{
				id: "v1",
				key: "TOKEN",
				value: shared.encrypt(SECRET, slot),
				sealed: true,
			},
			{ id: "v2", key: "BASE", value: "https://api.example", sealed: false },
		],
	});
	await raw("local_variable_values").insertOne({
		tenantId: MOVING,
		userId: "acc_1",
		scope: "global:abc",
		key: "K",
		value: shared.encrypt(SECRET, localSlot("acc_1", "global:abc", "K")),
		sealed: true,
	});
	await raw("sessions").insertOne({ tenantId: MOVING, sid: "not-moved" });
	await raw("projects").insertOne({ tenantId: STAYING, name: "stays" });
});

afterAll(async () => {
	await rm(dir, { recursive: true, force: true });
	await teardown();
});

async function migrationKeys() {
	const { publicKey, privateKey } = await generateKeyPair("ECDH-ES+A256KW", {
		crv: "P-256",
		extractable: true,
	});
	return {
		publicJwk: await exportJWK(publicKey),
		privateJwk: await exportJWK(privateKey),
	};
}

describe("moving a tenant's Localman data", () => {
	it("leaves with no readable secret, arrives as the primary tenant with its own keyring", async () => {
		const { publicJwk, privateJwk } = await migrationKeys();
		const moveKey = createMoveKey(MOVING);
		const manifest = await exportTenantData(
			MOVING,
			dir,
			resealWith(shared, new TokenCipher(moveKey.keyring)),
		);
		const counts = Object.fromEntries(
			manifest.collections.map((c) => [c.collection, c.count]),
		);
		expect(counts.environments).toBe(1);
		expect(counts.local_variable_values).toBe(1);
		expect(counts.projects).toBe(0);
		expect(counts.sessions).toBeUndefined();
		for (const file of await readdir(dir)) {
			expect(await readFile(join(dir, file), "utf8")).not.toContain(SECRET);
		}

		const opened = await openMoveKey(
			await sealMoveKey(moveKey, publicJwk),
			privateJwk,
		);
		expect(opened.tenantId).toBe(MOVING);
		// The install's database is another one: the source's copies go.
		for (const name of ["environments", "local_variable_values"]) {
			await raw(name).deleteMany({ tenantId: MOVING });
		}
		expect(await countMovedData("primary")).toBe(0);
		await importTenantData(
			dir,
			"primary",
			resealWith(new TokenCipher(opened.keyring), install),
		);

		const env = await raw("environments").findOne({ tenantId: "primary" });
		const sealed = env?.variables?.[0]?.value;
		expect(env?._id.equals(envId)).toBe(true);
		expect(
			install.decrypt(sealed, sharedSlot(environmentScope(envId), "v1")),
		).toBe(SECRET);
		expect(env?.variables?.[1]?.value).toBe("https://api.example");
		const local = await raw("local_variable_values").findOne({
			tenantId: "primary",
		});
		expect(
			install.decrypt(local?.value, localSlot("acc_1", "global:abc", "K")),
		).toBe(SECRET);
		expect(await raw("sessions").countDocuments({ tenantId: "primary" })).toBe(
			0,
		);
		expect(await raw("projects").countDocuments({ tenantId: STAYING })).toBe(1);
	});

	it("opens the move key only with the install's own migration key", async () => {
		const ours = await migrationKeys();
		const other = await migrationKeys();
		const sealed = await sealMoveKey(createMoveKey(MOVING), ours.publicJwk);
		await expect(openMoveKey(sealed, other.privateJwk)).rejects.toThrow();
		await expect(
			sealMoveKey(createMoveKey(MOVING), ours.privateJwk),
		).rejects.toThrow(/public key/);
	});
});
