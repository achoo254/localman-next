import { Types } from "mongoose";
import request from "supertest";
import { describe, expect, it } from "vitest";
import {
	DEFAULT_RUNTIME_SETTINGS,
	configureRuntime,
} from "../../config/runtime-settings.js";
import { createDashboardApp } from "../../dashboard-server.js";
import { RateLimitWindowModel } from "../../lib/rate-limit-windows.js";
import { as, guest } from "../../test-support/dashboard-test-app.js";
import { captureLogs } from "../../test-support/log-capture.js";
import { startClearOfRateWindowEdge } from "../../test-support/rate-window-edge.js";
import { ADA, EVE, VIC } from "../access/testing/access-fixture.js";
import { CollectionModel } from "../collections/collection-model.js";
import { useCollectionTestDb } from "../collections/testing/collection-fixture.js";
import { WorkspaceMemberModel } from "../workspaces/workspace-member-model.js";
import { CollectionAccessKeyModel } from "./collection-access-key-model.js";
import {
	expectNoSecrets,
	sensitiveCollection,
	setSharing,
} from "./testing/public-sharing-fixture.js";

useCollectionTestDb();

async function createKey(sub: string, id: string): Promise<string> {
	const res = await as(sub).send("post", `/collections/${id}/access-keys`, {
		name: "CI",
	});
	expect(res.status, JSON.stringify(res.body)).toBe(201);
	return res.body.key;
}

const read = (id: string, key: string, ip?: string) =>
	guest(ip).get(
		`/public/collections/${id}?access_key=${encodeURIComponent(key)}`,
	);

async function expectInvalid(id: string, key: string): Promise<void> {
	const res = await read(id, key);
	expect(res.status).toBe(401);
	expect(res.body.error).toEqual({
		code: "ACCESS_KEY_INVALID",
		message: "The access key is invalid or expired",
	});
}

describe("collection access keys", () => {
	it("return redacted v2.1 JSON and are shown once, stored hashed", async () => {
		const { id } = await sensitiveCollection();
		const key = await createKey(EVE, id);
		expect(key).toMatch(/^lmck_[A-Za-z0-9_-]{43}$/);
		const stored = await CollectionAccessKeyModel.findOne().lean();
		expect(JSON.stringify(stored)).not.toContain(key);
		const res = await read(id, key);
		expect(res.status, JSON.stringify(res.body)).toBe(200);
		expect(res.body.info.name).toBe("Payments");
		expectNoSecrets(res.body);
		const list = await as(EVE).get(`/collections/${id}/access-keys`);
		expect(list.body.items).toHaveLength(1);
		expect(JSON.stringify(list.body)).not.toContain(key);
		expect(list.body.items[0].lastUsedAt).not.toBeNull();
	});

	it("answer the same 401 for every reason a key fails", async () => {
		const { ws, id } = await sensitiveCollection();
		const other = await sensitiveCollection();
		const key = await createKey(EVE, id);
		await expectInvalid(id, "lmck_wrong");
		await expectInvalid(id, "no-prefix");
		await expectInvalid(other.id, key);
		await expectInvalid("not-an-id", key);
		await setSharing(ws, { accessKeysAllowed: false });
		await expectInvalid(id, key);
		await setSharing(ws, { accessKeysAllowed: true });
		await WorkspaceMemberModel.updateOne(
			{ workspaceId: new Types.ObjectId(ws), userId: EVE },
			{ role: "viewer" },
		);
		await expectInvalid(id, key);
		await WorkspaceMemberModel.updateOne(
			{ workspaceId: new Types.ObjectId(ws), userId: EVE },
			{ role: "editor" },
		);
		const old = new Date(Date.now() - 61 * 24 * 60 * 60 * 1000);
		await CollectionAccessKeyModel.updateOne({}, { lastUsedAt: old });
		await expectInvalid(id, key);
		await CollectionAccessKeyModel.updateOne({}, { lastUsedAt: new Date() });
		expect((await read(id, key)).status).toBe(200);
		await CollectionModel.updateOne(
			{ _id: new Types.ObjectId(id) },
			{ deletedAt: new Date(), deletedBy: EVE },
		);
		await expectInvalid(id, key);
	});

	it("are revoked by their creator or an Admin, not by others", async () => {
		const { id } = await sensitiveCollection();
		const key = await createKey(EVE, id);
		const [row] = (await as(EVE).get(`/collections/${id}/access-keys`)).body
			.items;
		const path = `/collections/${id}/access-keys/${row.id}`;
		expect((await as(VIC).send("delete", path)).status).toBe(404);
		expect(
			(await as(VIC).get(`/collections/${id}/access-keys`)).body.items,
		).toEqual([]);
		expect(
			(await as(ADA).get(`/collections/${id}/access-keys`)).body.items,
		).toHaveLength(1);
		const preview = await as(ADA).send("delete", `${path}?dryRun=true`);
		expect(preview.body).toMatchObject({ dryRun: true, revoked: false });
		const done = await as(ADA).send("delete", path);
		expect(done.body).toMatchObject({ dryRun: false, revoked: true });
		await expectInvalid(id, key);
	});

	it("are created only by Admin and Editor members, ten per person", async () => {
		const { ws, id } = await sensitiveCollection();
		const viewer = await as(VIC).send(
			"post",
			`/collections/${id}/access-keys`,
			{
				name: "x",
			},
		);
		expect(viewer.status).toBe(403);
		for (let n = 0; n < 10; n += 1) await createKey(EVE, id);
		const full = await as(EVE).send("post", `/collections/${id}/access-keys`, {
			name: "x",
		});
		expect(full.body.error.code).toBe("ACCESS_KEY_LIMIT_REACHED");
		await setSharing(ws, { accessKeysAllowed: false });
		const off = await as(ADA).send("post", `/collections/${id}/access-keys`, {
			name: "x",
		});
		expect(off.body.error.code).toBe("ACCESS_KEYS_DISABLED");
	});

	it("limit guesses per address without a counter per guess, and matched keys per key", async () => {
		await startClearOfRateWindowEdge(60_000);
		const { id } = await sensitiveCollection();
		const key = await createKey(EVE, id);
		configureRuntime({
			...DEFAULT_RUNTIME_SETTINGS,
			publicSharingRateLimit: {
				...DEFAULT_RUNTIME_SETTINGS.publicSharingRateLimit,
				accessKeyPerIp: { max: 3, windowMs: 60_000 },
				accessKeyPerKey: { max: 1, windowMs: 60_000 },
			},
		});
		const ip = "203.0.113.20";
		for (const guess of ["lmck_a", "lmck_b", "lmck_c"]) {
			expect((await read(id, guess, ip)).status).toBe(401);
		}
		expect((await read(id, "lmck_d", ip)).status).toBe(429);
		expect(await RateLimitWindowModel.countDocuments()).toBe(1);
		expect((await read(id, key, "203.0.113.21")).status).toBe(200);
		expect((await read(id, key, "203.0.113.22")).status).toBe(429);
	});

	it("never reach the request log", async () => {
		const { id } = await sensitiveCollection();
		const key = await createKey(EVE, id);
		const logs = captureLogs();
		const app = createDashboardApp({
			logger: logs.logger,
			allowedOrigins: ["https://localman.test"],
		});
		const res = await request(app).get(
			`/api/v1/public/collections/${id}?access_key=${key}`,
		);
		expect(res.status).toBe(200);
		expect(logs.entries("request")).toHaveLength(1);
		expect(logs.lines.join("")).not.toContain(key);
		expect(logs.lines.join("")).not.toContain("access_key");
	});
});
