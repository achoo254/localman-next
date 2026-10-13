import { TENANT_SCOPED } from "@localman/tenancy";
import mongoose from "mongoose";
import { expect, test } from "vitest";
import "../../db/models/api-key-model.js";
import "../../db/models/link-request-model.js";
import "../../db/models/login-request-model.js";
import "../../db/models/usage-log-model.js";
import "../../web/web-session-model.js";

test("every Tunelo model is tenant-scoped, every index but TTL leads with tenantId", () => {
	const names = mongoose.modelNames();
	expect(names.sort()).toEqual(
		["ApiKey", "LinkRequest", "LoginRequest", "UsageLog", "WebSession"].sort(),
	);
	for (const name of names) {
		const schema = mongoose.model(name).schema;
		expect(Reflect.get(schema, TENANT_SCOPED), name).toBe(true);
		for (const [fields, options] of schema.indexes()) {
			if ("expireAfterSeconds" in options) continue;
			expect(Object.keys(fields)[0], name).toBe("tenantId");
		}
	}
});
