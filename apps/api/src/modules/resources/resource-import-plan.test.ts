import { describe, expect, it } from "vitest";
import { renameKey } from "./resource-import-parent-key.js";
import { type ImportRequest, planImport } from "./resource-import-plan.js";

const request = (input: unknown, names: Record<string, string>) =>
	({
		format: "json",
		input: JSON.stringify(input),
		includeRelated: true,
		names,
	}) satisfies ImportRequest;

describe("planImport parent keys", () => {
	it("renames a field that the renamed parent's key would overwrite", () => {
		const plan = planImport(
			request(
				{ users: [{ name: "Ada", posts: [{ authorId: 5 }] }] },
				{
					users: "authors",
				},
			),
		);
		const posts = plan.resources.find((resource) => resource.key === "posts");
		expect(posts?.parentName).toBe("authors");
		expect(posts?.fields.map((field) => field.name)).toEqual(["authorId_2"]);
		expect(posts?.records).toEqual([{ id: "1", authorId: "1", authorId_2: 5 }]);
		expect(plan.warnings).toContainEqual(
			expect.objectContaining({
				code: "RENAMED",
				path: "posts.authorId",
				params: { from: "authorId", to: "authorId_2" },
			}),
		);
	});

	it("skips taken names and leaves other imports alone", () => {
		const taken = planImport(
			request(
				{ users: [{ posts: [{ authorId: 5, authorId_2: 6, title: "t" }] }] },
				{ users: "authors" },
			),
		);
		const posts = taken.resources.find((resource) => resource.key === "posts");
		expect(posts?.records[0]).toEqual({
			id: "1",
			authorId: "1",
			authorId_3: 5,
			authorId_2: 6,
			title: "t",
		});
		const plain = planImport(
			request({ users: [{ name: "a", posts: [{ title: "t" }] }] }, {}),
		);
		expect(plain.warnings.map((warning) => warning.code)).not.toContain(
			"RENAMED",
		);
		expect(plain.resources[1]?.records).toEqual([
			{ id: "1", userId: "1", title: "t" },
		]);
	});

	it("never overwrites a key when renaming it", () => {
		expect(renameKey({ a: 1, b: 2 }, "a", "c")).toEqual({ c: 1, b: 2 });
		expect(() => renameKey({ a: 1, b: 2 }, "a", "b")).toThrow(/overwrite/);
	});
});
