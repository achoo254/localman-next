import { describe, expect, it } from "vitest";
import { detail, folder, request, summary } from "./collections-test-utils";
import { buildTreeRows, parentRowId, sortCollections } from "./tree-rows";
import { matchRange } from "./tree-search";
import type { DetailState } from "./use-collections";

describe("matchRange", () => {
	it("ignores case and accents and maps back to the original name", () => {
		expect(matchRange("Đăng nhập", "dang")).toEqual([0, 4]);
		expect(matchRange("List USERS", "users")).toEqual([5, 10]);
		expect(matchRange("Tạo user", "tao")).toEqual([0, 3]);
	});

	it("keeps decomposed accents inside the highlighted range", () => {
		const name = "Café orders";
		expect(matchRange(name, "café")).toEqual([0, 5]);
	});

	it("answers null for a blank query or no match", () => {
		expect(matchRange("Orders", "  ")).toBeNull();
		expect(matchRange("Orders", "users")).toBeNull();
	});
});

describe("sortCollections", () => {
	const list = [
		summary("a", { name: "beta", updatedAt: "2026-10-01T00:00:00Z" }),
		summary("b", { name: "Alpha", updatedAt: "2026-10-03T00:00:00Z" }),
		summary("c", { name: "zeta", favorite: true }),
		summary("d", { name: "item 10", updatedAt: "2026-10-02T00:00:00Z" }),
		summary("e", { name: "item 9", updatedAt: "2026-09-01T00:00:00Z" }),
	];
	const names = (sort: Parameters<typeof sortCollections>[1]) =>
		sortCollections(list, sort).map((item) => item.name);

	it("puts favorites first, then sorts by name with numbers in order", () => {
		expect(names("name-asc")).toEqual([
			"zeta",
			"Alpha",
			"beta",
			"item 9",
			"item 10",
		]);
		expect(names("name-desc")).toEqual([
			"zeta",
			"item 10",
			"item 9",
			"beta",
			"Alpha",
		]);
	});

	it("sorts by the latest update", () => {
		expect(names("updated")).toEqual([
			"zeta",
			"Alpha",
			"item 10",
			"beta",
			"item 9",
		]);
	});
});

describe("buildTreeRows", () => {
	const users = detail("c1", [
		folder("f1", null, "a1", "Users"),
		request("r1", "f1", "a0", "List users"),
		folder("f2", "f1", "a1", "Admin"),
		request("r2", "f2", "a0", "Ban user"),
		request("r3", null, "a0", "Health"),
	]);
	const collections = [summary("c1", { name: "Shop" }), summary("c2")];
	const details = new Map<string, DetailState>([
		["c1", { status: "ready", detail: users }],
		["c2", { status: "loading" }],
	]);
	const ids = (rows: ReturnType<typeof buildTreeRows>) =>
		rows.map((row) => `${row.depth}:${row.id}`);

	it("shows only collections until they are expanded", () => {
		const rows = buildTreeRows({
			collections,
			details,
			expanded: new Set(),
		});
		expect(ids(rows)).toEqual(["0:c1", "0:c2"]);
		expect(rows[1]).toMatchObject({ items: "closed", expanded: false });
	});

	it("lists expanded items in their stored order, folders nested", () => {
		const rows = buildTreeRows({
			collections,
			details,
			expanded: new Set(["c1", "f1", "c2"]),
		});
		expect(ids(rows)).toEqual(["0:c1", "1:r3", "1:f1", "2:r1", "2:f2", "0:c2"]);
		expect(rows.find((row) => row.id === "f2")).toMatchObject({
			expanded: false,
			hasChildren: true,
		});
		expect(rows.at(-1)).toMatchObject({ items: "loading" });
	});

	it("names the parent row of each item", () => {
		const rows = buildTreeRows({
			collections,
			details,
			expanded: new Set(["c1", "f1"]),
		});
		const parents = rows.map((row) => parentRowId(row));
		expect(parents).toEqual([null, "c1", "c1", "f1", "f1", null]);
	});
});
