import { describe, expect, it } from "vitest";
import {
	as,
	useDashboardTestDb,
} from "../../test-support/dashboard-test-app.js";
import { useProjectFixture } from "./testing/project-fixture.js";

const ALICE = "acc_list_meta_alice";
const BOB = "acc_list_meta_bob";

useDashboardTestDb(() => ({ mockBaseDomain: "mock.test" }));
const { createAs } = useProjectFixture(ALICE, BOB);

const resources = (projectId: string) => `/projects/${projectId}/resources`;

describe("project list meta", () => {
	it("counts resources, nested ones included, and their records", async () => {
		const shop = await createAs(ALICE, "Shop");
		const empty = await createAs(ALICE, "Empty");
		const users = await as(ALICE).send("post", resources(shop.id), {
			name: "users",
		});
		const posts = await as(ALICE).send("post", resources(shop.id), {
			name: "posts",
			parentId: users.body.id,
		});
		for (const [id, count] of [
			[users.body.id, 3],
			[posts.body.id, 5],
		] as const) {
			const res = await as(ALICE).send(
				"post",
				`${resources(shop.id)}/${id}/generate`,
				{ count },
			);
			expect(res.status).toBe(200);
		}
		const list = await as(ALICE).get("/projects");
		expect(list.status).toBe(200);
		const byId = new Map(
			list.body.items.map((item: { id: string }) => [item.id, item]),
		);
		expect(byId.get(shop.id)).toMatchObject({
			resourceCount: 2,
			recordCount: 8,
		});
		expect(byId.get(empty.id)).toMatchObject({
			resourceCount: 0,
			recordCount: 0,
		});
		const one = await as(ALICE).get(`/projects/${shop.id}`);
		expect(one.body).toMatchObject({ resourceCount: 2, recordCount: 8 });
	});

	it("accepts version-like names with . · , & + ' :", async () => {
		for (const name of ["Shop v2.0", "Shop · v2", "R&D: Jev's shop, A + B"]) {
			const res = await as(ALICE).send("post", "/projects", { name });
			expect(res.status, name).toBe(201);
			expect(res.body.name).toBe(name);
		}
		const bad = await as(ALICE).send("post", "/projects", { name: "a/b" });
		expect(bad.status).toBe(400);
		expect(bad.body.error.code).toBe("VALIDATION_ERROR");
	});
});
