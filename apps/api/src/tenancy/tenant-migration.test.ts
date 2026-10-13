import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import "../db/register-models.js";
import { createLogger } from "../logger.js";
import { SessionModel } from "../modules/auth/session-model.js";
import { CollectionRevisionModel } from "../modules/collections/collection-revision-model.js";
import { OutboundJobModel } from "../modules/mock-callbacks/outbound-job-model.js";
import { ProjectModel } from "../modules/projects/project-model.js";
import { connectTestMongo } from "../test-support/test-mongo.js";
import {
	dropReplacedIndexes,
	migrateToTenants,
	tagUntaggedDocuments,
} from "./tenant-migration.js";

const logger = createLogger("silent");
let teardown: () => Promise<void>;

beforeAll(async () => {
	teardown = await connectTestMongo();
});
afterAll(async () => {
	await teardown();
});

describe("migrateToTenants", () => {
	it("tags old documents with the primary tenant and drops the indexes they replace", async () => {
		const projects = ProjectModel.collection;
		// As the release before tenants left them.
		await projects.dropIndexes();
		await projects.createIndex({ secret: 1 }, { unique: true });
		await projects.createIndex({ owner: 1, quotaSlot: 1 }, { unique: true });
		await projects.createIndex({ name: 1 }, { name: "ops_by_name" });
		await projects.insertOne({
			name: "old",
			secret: "s1",
			owner: "o",
			quotaSlot: 0,
		});

		// What startup does; `init()` already ran for this connection, so
		// the index build is asked for directly.
		expect(await tagUntaggedDocuments(logger)).toBe(1);
		await ProjectModel.createIndexes();
		expect(await dropReplacedIndexes(logger)).toEqual([
			"secret_1",
			"owner_1_quotaSlot_1",
		]);

		const stored = await projects.findOne({ secret: "s1" });
		expect(stored?.tenantId).toBe("primary");
		const names = (await projects.indexes()).map((index) => index.name);
		expect(names).toEqual(
			expect.arrayContaining([
				"tenantId_1_secret_1",
				"tenantId_1_owner_1_quotaSlot_1",
				"ops_by_name",
			]),
		);
		expect(names).not.toContain("secret_1");
		expect(names).not.toContain("owner_1_quotaSlot_1");
		// TTL indexes stay single-field.
		const sessionIndexes = await SessionModel.collection.indexes();
		expect(sessionIndexes.some((index) => "expireAfterSeconds" in index)).toBe(
			true,
		);
	});

	it("builds named indexes under a new name, then drops the old ones", async () => {
		const revisions = CollectionRevisionModel.collection;
		await revisions.dropIndexes();
		// Production has these since before tenants, with the old keys.
		await revisions.createIndex(
			{ collectionId: 1, partial: 1, seq: -1 },
			{ name: "partial_by_seq", partialFilterExpression: { partial: true } },
		);
		await revisions.createIndex(
			{ collectionId: 1, trimmed: 1, seq: -1 },
			{ name: "trimmed_by_seq", partialFilterExpression: { trimmed: true } },
		);
		await CollectionRevisionModel.createIndexes();
		expect((await dropReplacedIndexes(logger)).sort()).toEqual([
			"partial_by_seq",
			"trimmed_by_seq",
		]);
		const names = (await revisions.indexes()).map((index) => index.name);
		expect(names).toEqual(
			expect.arrayContaining([
				"tenant_partial_by_seq",
				"tenant_trimmed_by_seq",
			]),
		);
	});

	it("keeps the queue's indexes without the tenant prefix", async () => {
		const keys = (await OutboundJobModel.collection.indexes()).map((index) =>
			JSON.stringify(index.key),
		);
		expect(keys).toEqual(
			expect.arrayContaining([
				JSON.stringify({ state: 1, nextAt: 1 }),
				JSON.stringify({ deadlineAt: 1 }),
				JSON.stringify({ tenantId: 1, owner: 1 }),
			]),
		);
	});

	it("is cheap to repeat: nothing left to tag", async () => {
		expect(await tagUntaggedDocuments(logger)).toBe(0);
		await expect(migrateToTenants(logger, true)).resolves.toBeUndefined();
		expect(mongoose.connection.readyState).toBe(1);
	});
});
