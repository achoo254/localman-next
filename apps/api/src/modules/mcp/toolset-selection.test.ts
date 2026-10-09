import { OperationError } from "@localman/operations";
import { describe, expect, it } from "vitest";
import {
	createMemoryToolsetSelectionStore,
	parseToolsetsParam,
} from "./toolset-selection.js";

describe("parseToolsetsParam", () => {
	it("defaults to mock and client", () => {
		expect(parseToolsetsParam(undefined)).toEqual(["mock", "client"]);
		expect(parseToolsetsParam("")).toEqual(["mock", "client"]);
		expect(parseToolsetsParam(" , ")).toEqual(["mock", "client"]);
	});

	it("reads a comma-separated list without duplicates", () => {
		expect(parseToolsetsParam("admin, mock,admin")).toEqual(["admin", "mock"]);
		expect(parseToolsetsParam("mock-advanced")).toEqual(["mock-advanced"]);
	});

	it("rejects unknown names, non-strings and oversized values", () => {
		for (const raw of ["mock,nope", ["mock"], "x".repeat(513)]) {
			let error: unknown;
			try {
				parseToolsetsParam(raw);
			} catch (caught) {
				error = caught;
			}
			expect(error).toBeInstanceOf(OperationError);
			expect(error).toMatchObject({ status: 400, code: "VALIDATION_ERROR" });
		}
	});
});

describe("createMemoryToolsetSelectionStore", () => {
	it("remembers toolsets per principal", () => {
		const store = createMemoryToolsetSelectionStore();
		store.add("a", "admin");
		store.add("a", "admin");
		store.add("a", "users");
		expect(store.get("a")).toEqual(["admin", "users"]);
		expect(store.get("b")).toEqual([]);
	});

	it("forgets a choice after the TTL", () => {
		let now = 0;
		const store = createMemoryToolsetSelectionStore({
			ttlMs: 1_000,
			now: () => now,
		});
		store.add("a", "admin");
		now = 999;
		expect(store.get("a")).toEqual(["admin"]);
		now = 1_000;
		expect(store.get("a")).toEqual([]);
	});

	it("drops the oldest principal beyond maxEntries", () => {
		const store = createMemoryToolsetSelectionStore({ maxEntries: 2 });
		store.add("a", "admin");
		store.add("b", "admin");
		store.add("a", "users");
		store.add("c", "admin");
		expect(store.get("b")).toEqual([]);
		expect(store.get("a")).toEqual(["admin", "users"]);
		expect(store.get("c")).toEqual(["admin"]);
	});
});
