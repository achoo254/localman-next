import mongoose, { Schema } from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connectTestMongo } from "../test-support/test-mongo.js";
import { initModels } from "./connect-mongo.js";

let teardown: (() => Promise<void>) | undefined;
beforeAll(async () => {
	teardown = await connectTestMongo();
});
afterAll(async () => {
	mongoose.deleteModel("IndexProbe");
	await teardown?.();
});

describe("initModels", () => {
	it("rejects when a unique index cannot be built, so startup fails fast", async () => {
		// Duplicates written before the model (and its index) exist.
		await mongoose.connection
			.collection("index_probes")
			.insertMany([{ key: "same" }, { key: "same" }]);
		const schema = new Schema(
			{ key: { type: String, unique: true } },
			{ collection: "index_probes" },
		);
		mongoose.model("IndexProbe", schema);
		await expect(initModels()).rejects.toThrow(/duplicate key/i);
	});
});
