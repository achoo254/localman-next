import { beforeEach, describe, expect, it } from "vitest";
import {
	as,
	guest,
	useDashboardTestDb,
} from "../../test-support/dashboard-test-app.js";
import { UserModel } from "../users/user-model.js";
import { createProject, createResource } from "./testing/resource-fixture.js";

const ALICE = "acc_alice";
const BOB = "acc_bob";
useDashboardTestDb(() => ({ mockBaseDomain: "mock.test" }));
beforeEach(async () => {
	await UserModel.create([
		{ sub: ALICE, username: "alice" },
		{ sub: BOB, username: "bob" },
	]);
});

describe("export_resource_types (POST /projects/:projectId/resource-types)", () => {
	it("exports TypeScript and Zod for the whole tree or the listed resources", async () => {
		const projectId = await createProject(ALICE);
		const users = await createResource(ALICE, projectId, {
			name: "users",
			schema: [
				{ name: "email", type: "Faker.js", fakerMethod: "internet.email" },
			],
		});
		await createResource(ALICE, projectId, {
			name: "posts",
			parentId: users.id,
			schema: [{ name: "title", type: "String" }],
		});
		const path = `/projects/${projectId}/resource-types`;
		const ts = await as(ALICE).send("post", path, { format: "typescript" });
		expect(ts.status, JSON.stringify(ts.body)).toBe(200);
		expect(ts.body.format).toBe("typescript");
		expect(ts.body.code).toContain("export interface User {");
		expect(ts.body.code).toContain("userId: string;");
		const zod = await as(ALICE).send("post", path, {
			format: "zod",
			resourceIds: [users.id],
		});
		expect(zod.body.code).toContain('import { z } from "zod";');
		expect(zod.body.code).toContain("export const userSchema = z.object(");
		expect(zod.body.code).not.toContain("Post");

		const unknown = await as(ALICE).send("post", path, {
			format: "zod",
			resourceIds: ["a".repeat(24)],
		});
		expect(unknown.status).toBe(404);
		const stranger = await as(BOB).send("post", path, { format: "zod" });
		expect(stranger.status).toBe(404);
	});
});

describe("suggest_faker_methods (POST /faker-methods/suggestions)", () => {
	it("suggests methods that fit the field type, with a confidence", async () => {
		const res = await as(ALICE).send("post", "/faker-methods/suggestions", {
			fields: [
				{ name: "email" },
				{ name: "so_dien_thoai", type: "String" },
				{ name: "createdAt", type: "Date" },
				{ name: "price", type: "Number" },
				{ name: "settings", type: "Object" },
				{ name: "zzz" },
			],
		});
		expect(res.status, JSON.stringify(res.body)).toBe(200);
		const byName = new Map(
			(res.body.suggestions as { name: string; method: string | null }[]).map(
				(s) => [s.name, s],
			),
		);
		expect(byName.get("email")).toEqual({
			name: "email",
			type: "Faker.js",
			method: "internet.email",
			confidence: 0.95,
		});
		expect(byName.get("so_dien_thoai")?.method).toBe("phone.number");
		expect(byName.get("createdAt")?.method).toBe("date.past");
		expect(byName.get("price")?.method).toEqual(expect.any(String));
		expect(byName.get("settings")).toMatchObject({
			method: null,
			confidence: null,
		});
		expect(byName.get("zzz")?.method).toBeNull();
	});

	it("validates the fields and needs a signed-in user", async () => {
		const empty = await as(ALICE).send("post", "/faker-methods/suggestions", {
			fields: [],
		});
		expect(empty.status).toBe(400);
		expect(empty.body.error.code).toBe("VALIDATION_ERROR");
		const anonymous = await guest().send("post", "/faker-methods/suggestions", {
			fields: [{ name: "email" }],
		});
		expect(anonymous.status).toBe(401);
	});
});
