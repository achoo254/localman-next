import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import mongoose from "mongoose";
import { describe, expect, it } from "vitest";
import "../db/register-models.js";
import { TENANT_SCOPED } from "./tenant-scope-plugin.js";

const SRC = join(import.meta.dirname, "..");

function sourceFiles(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) return sourceFiles(path);
		const source =
			entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts");
		return source ? [path] : [];
	});
}

describe("tenant-owned models", () => {
	it("every model is tenant-scoped, and every index but TTL leads with tenantId", () => {
		const names = mongoose.modelNames();
		expect(names).toEqual(
			expect.arrayContaining(["Session", "AuditEvent", "Project", "User"]),
		);
		expect(names.length).toBeGreaterThanOrEqual(41);
		for (const name of names) {
			const schema = mongoose.model(name).schema;
			expect(Reflect.get(schema, TENANT_SCOPED), name).toBe(true);
			for (const [fields, options] of schema.indexes()) {
				const ttl = "expireAfterSeconds" in options || "expires" in options;
				if (!ttl) expect(Object.keys(fields)[0], name).toBe("tenantId");
			}
		}
	});

	it("bypasses the scope only where listed", () => {
		const callers = sourceFiles(SRC)
			.filter((path) => !path.includes(`${join("src", "test-support")}`))
			.filter((path) => {
				const text = readFileSync(path, "utf8");
				return /acrossTenants\(|\.collection\.(insert|update|delete|find|replace|bulkWrite)/.test(
					text,
				);
			})
			.map((path) => relative(SRC, path))
			.sort();
		expect(callers).toEqual(
			[
				// Raw record writes: tenantId set by hand.
				"modules/mock-runtime/crud-handlers.ts",
				// Trims by project id, unique across tenants.
				"modules/mock-runtime/request-log-service.ts",
				// Claims jobs of every tenant, runs each in its own.
				"modules/mock-callbacks/outbound-claims.ts",
				"modules/mock-callbacks/retry-queue.ts",
				// Lists the tenants that have users.
				"tenancy/each-tenant.ts",
			].sort(),
		);
	});
});
