import mongoose from "mongoose";
import { describe, expect, it } from "vitest";
import "../../db/register-models.js";
import { ACCOUNT_DATA_POLICY } from "./account-data-policy.js";

describe("account data policy", () => {
	it("decides what account deletion does to every registered model", () => {
		const models = [...mongoose.modelNames()].sort();
		expect(Object.keys(ACCOUNT_DATA_POLICY).sort()).toEqual(models);
	});
});
