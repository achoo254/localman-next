import { CrossTenantWriteError, MissingTenantError } from "@localman/tenancy";
import mongoose, { Schema } from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connectTestMongo } from "../test-support/test-mongo.js";
import { TEST_TENANT } from "../test-support/test-tenant.js";
import { acrossTenants, runInTenant } from "./tenant-context.js";
import { tenantScopePlugin } from "./tenant-scope-plugin.js";

const OTHER = { ...TEST_TENANT, id: "ten_AAAAAAAAAAAAAAAA" };
const noteSchema = new Schema({ key: String }, { collection: "plugin_notes" });
noteSchema.plugin(tenantScopePlugin);
const NoteModel = mongoose.model("PluginNote", noteSchema);

let teardown: () => Promise<void>;
beforeAll(async () => {
	teardown = await connectTestMongo();
});
afterAll(async () => {
	await teardown();
});

describe("writes that would cross tenants", () => {
	it("refuses to move a document to another tenant or drop its tenantId", async () => {
		await NoteModel.create({ key: "n" });
		for (const update of [
			{ $set: { tenantId: OTHER.id } },
			{ tenantId: OTHER.id },
			{ $unset: { tenantId: 1 } },
			{ $rename: { key: "tenantId" } },
		]) {
			await expect(
				NoteModel.updateOne({ key: "n" }, update).exec(),
				JSON.stringify(update),
			).rejects.toBeInstanceOf(CrossTenantWriteError);
		}
		await expect(
			NoteModel.bulkWrite([
				{ updateOne: { filter: {}, update: { $set: { tenantId: OTHER.id } } } },
			]),
		).rejects.toBeInstanceOf(CrossTenantWriteError);
		// Naming its own tenant is harmless.
		await NoteModel.updateOne(
			{ key: "n" },
			{ $set: { tenantId: TEST_TENANT.id } },
		);
		expect(await acrossTenants(() => NoteModel.countDocuments().exec())).toBe(
			1,
		);
	});

	it("refuses another tenant's documents in insertMany, lean included", async () => {
		await expect(
			NoteModel.insertMany([{ key: "x", tenantId: OTHER.id }], { lean: true }),
		).rejects.toBeInstanceOf(CrossTenantWriteError);
	});

	it("refuses a count no filter can limit, and an unawaited query", async () => {
		await expect(
			NoteModel.estimatedDocumentCount().exec(),
		).rejects.toBeInstanceOf(MissingTenantError);
		expect(() => runInTenant(OTHER, () => NoteModel.find())).toThrow(TypeError);
		expect(await runInTenant(OTHER, () => NoteModel.find().exec())).toEqual([]);
	});
});
