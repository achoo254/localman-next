import mongoose, { Schema } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	clearCollections,
	connectTestMongo,
} from "../test-support/test-mongo.js";
import {
	type LocalmanTenant,
	MissingTenantError,
	acrossTenants,
	runInTenant,
	setTestDefaultTenant,
} from "./tenant-context.js";
import {
	CrossTenantWriteError,
	tenantScopePlugin,
} from "./tenant-scope-plugin.js";

function tenant(id: string): LocalmanTenant {
	return {
		id,
		domain: `${id}.test`,
		displayName: id,
		issuer: `https://auth.${id}.test`,
		publicUrl: `https://localman.${id}.test`,
		mockBaseDomain: `localman.${id}.test`,
		ownerSubs: new Set(),
	};
}
const A = tenant("a");
const B = tenant("b");

const itemSchema = new Schema(
	{
		key: { type: String, required: true, unique: true },
		count: { type: Number, default: 0 },
		child: { type: new Schema({ tag: { type: String, index: true } }) },
		expiresAt: { type: Date },
	},
	{ collection: "plugin_items", versionKey: false },
);
itemSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
itemSchema.plugin(tenantScopePlugin);
const ItemModel = mongoose.model("PluginItem", itemSchema);

let teardown: () => Promise<void>;
beforeAll(async () => {
	setTestDefaultTenant(undefined);
	teardown = await connectTestMongo();
});
afterAll(async () => {
	await teardown();
});
beforeEach(async () => {
	await clearCollections();
});

describe("tenantScopePlugin", () => {
	it("prefixes every index with tenantId, TTL indexes excepted", () => {
		const keys = ItemModel.schema.indexes().map(([fields]) => fields);
		expect(keys).toEqual(
			expect.arrayContaining([
				{ tenantId: 1, key: 1 },
				{ tenantId: 1, "child.tag": 1 },
				{ expiresAt: 1 },
			]),
		);
		expect(keys).not.toContainEqual({ key: 1 });
	});

	it("keeps the same unique key apart per tenant and hides it from the other", async () => {
		await runInTenant(A, () => ItemModel.create({ key: "k", count: 1 }));
		await runInTenant(B, () => ItemModel.create({ key: "k", count: 2 }));
		await expect(
			runInTenant(A, () => ItemModel.create({ key: "k" })),
		).rejects.toMatchObject({ code: 11000 });
		expect(
			await runInTenant(A, () => ItemModel.findOne({ key: "k" }).lean().exec()),
		).toMatchObject({ count: 1, tenantId: "a" });
		expect(await runInTenant(B, () => ItemModel.countDocuments().exec())).toBe(
			1,
		);
		await runInTenant(A, () =>
			ItemModel.updateMany({}, { $inc: { count: 10 } }).exec(),
		);
		await runInTenant(A, () =>
			ItemModel.deleteOne({ key: "k", count: 11 }).exec(),
		);
		expect(
			await runInTenant(A, () => ItemModel.exists({ key: "k" }).exec()),
		).toBeNull();
		expect(
			await runInTenant(B, () => ItemModel.findOne({ key: "k" }).lean().exec()),
		).toMatchObject({ count: 2 });
	});

	it("stamps upserts, replacements, insertMany and bulkWrite", async () => {
		await runInTenant(A, async () => {
			await ItemModel.updateOne(
				{ key: "u" },
				{ $set: { count: 1 } },
				{ upsert: true },
			);
			await ItemModel.findOneAndUpdate(
				{ key: "f" },
				{ count: 2 },
				{ upsert: true },
			);
			await ItemModel.insertMany([{ key: "m1" }, { key: "m2" }]);
			await ItemModel.insertMany([{ key: "l1" }], { lean: true });
			await ItemModel.bulkWrite([
				{ insertOne: { document: { key: "b1" } } },
				{
					updateOne: {
						filter: { key: "b2" },
						update: { count: 3 },
						upsert: true,
					},
				},
				{
					replaceOne: {
						filter: { key: "b3" },
						replacement: { key: "b3" },
						upsert: true,
					},
				},
			]);
			await ItemModel.replaceOne(
				{ key: "r" },
				{ key: "r", count: 4 },
				{ upsert: true },
			);
		});
		const all = await acrossTenants(() => ItemModel.find().lean().exec());
		expect(all).toHaveLength(9);
		expect(new Set(all.map((item) => Reflect.get(item, "tenantId")))).toEqual(
			new Set(["a"]),
		);
		expect(await runInTenant(B, () => ItemModel.countDocuments().exec())).toBe(
			0,
		);
	});

	it("updates and deletes in bulk only within the tenant", async () => {
		await runInTenant(A, () => ItemModel.create({ key: "x" }));
		await runInTenant(B, () => ItemModel.create({ key: "x" }));
		await runInTenant(B, () =>
			ItemModel.bulkWrite([
				{ updateOne: { filter: { key: "x" }, update: { count: 7 } } },
				{ deleteMany: { filter: {} } },
			]),
		);
		expect(
			await runInTenant(A, () => ItemModel.findOne({ key: "x" }).lean().exec()),
		).toMatchObject({ count: 0 });
		expect(await acrossTenants(() => ItemModel.countDocuments().exec())).toBe(
			1,
		);
	});

	it("limits aggregations to the tenant", async () => {
		await runInTenant(A, () => ItemModel.create({ key: "g", count: 1 }));
		await runInTenant(B, () => ItemModel.create({ key: "g", count: 5 }));
		const sums = await runInTenant(B, () =>
			ItemModel.aggregate<{ total: number }>([
				{ $group: { _id: null, total: { $sum: "$count" } } },
			]).exec(),
		);
		expect(sums).toEqual([{ _id: null, total: 5 }]);
	});

	it("throws without a tenant in scope, for reads and writes", async () => {
		await expect(ItemModel.find().exec()).rejects.toBeInstanceOf(
			MissingTenantError,
		);
		await expect(ItemModel.create({ key: "n" })).rejects.toBeInstanceOf(
			MissingTenantError,
		);
		await expect(
			ItemModel.bulkWrite([{ insertOne: { document: { key: "n" } } }]),
		).rejects.toBeInstanceOf(MissingTenantError);
	});

	it("refuses to save a document of another tenant", async () => {
		const item = await runInTenant(A, () => ItemModel.create({ key: "s" }));
		item.count = 9;
		await expect(runInTenant(B, () => item.save())).rejects.toBeInstanceOf(
			CrossTenantWriteError,
		);
	});
});
