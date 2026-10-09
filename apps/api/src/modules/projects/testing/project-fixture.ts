import type { Types } from "mongoose";
import { afterEach, beforeEach, expect } from "vitest";
import { as } from "../../../test-support/dashboard-test-app.js";
import { UserModel } from "../../users/user-model.js";
import { registerProjectDependent } from "../project-dependents.js";

export interface ProjectFixture {
	/** Rows of the stub dependent module, keyed by project id. */
	readonly stubRows: Map<string, string[]>;
	createAs(
		sub: string,
		name?: string,
		prefix?: string,
	): Promise<{ id: string; secret: string; name: string }>;
}

/**
 * TEST ONLY. Before each test: users `alice` (with a profile) and `bob`,
 * and an in-memory dependent module (`stub-rows`) that counts, deletes
 * and copies rows like a real one. Call after `useDashboardTestDb`.
 */
export function useProjectFixture(alice: string, bob: string): ProjectFixture {
	const stubRows = new Map<string, string[]>();
	let unregister: () => void = () => undefined;
	beforeEach(async () => {
		stubRows.clear();
		unregister = registerProjectDependent({
			kind: "stub-rows",
			count: async (id: Types.ObjectId) =>
				stubRows.get(id.toHexString())?.length ?? 0,
			deleteAll: async (id) => {
				stubRows.delete(id.toHexString());
			},
			copy: async (from, to) => {
				stubRows.set(to.toHexString(), [
					...(stubRows.get(from.toHexString()) ?? []),
				]);
			},
		});
		await UserModel.create([
			{
				sub: alice,
				username: "alice",
				name: "Alice",
				picture: "https://cdn.test/a.png",
			},
			{ sub: bob, username: "bob" },
		]);
	});
	afterEach(() => unregister());
	return {
		stubRows,
		createAs: async (sub, name = "Demo", prefix = "") => {
			const res = await as(sub).send("post", "/projects", { name, prefix });
			expect(res.status).toBe(201);
			return res.body;
		},
	};
}
