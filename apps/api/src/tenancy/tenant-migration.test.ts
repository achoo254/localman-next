import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import "../db/register-models.js";
import { createLogger } from "../logger.js";
import { SessionModel } from "../modules/auth/session-model.js";
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

	it("is cheap to repeat: nothing left to tag", async () => {
		expect(await tagUntaggedDocuments(logger)).toBe(0);
		await expect(migrateToTenants(logger)).resolves.toBeUndefined();
		expect(mongoose.connection.readyState).toBe(1);
	});
});
