import { limitsFor } from "@localman/shared";
import { beforeEach, describe, expect, it } from "vitest";
import {
	as,
	useDashboardTestDb,
} from "../../test-support/dashboard-test-app.js";
import { UserModel } from "../users/user-model.js";
import { ProjectModel } from "./project-model.js";
import { newProjectSecret } from "./project-service.js";

const USER = "acc_quota";
const OTHER = "acc_other";
const DAY_MS = 24 * 60 * 60 * 1000;

useDashboardTestDb();
beforeEach(async () => {
	await UserModel.create([
		{ sub: USER, username: "quota" },
		{ sub: OTHER, username: "other" },
	]);
});

/** Seeds owned projects directly, as the API would have numbered them. */
async function seedOwned(owner: string, count: number): Promise<void> {
	await ProjectModel.insertMany(
		Array.from({ length: count }, (_, slot) => ({
			name: `Seed ${slot}`,
			secret: newProjectSecret(),
			owner,
			quotaSlot: slot,
		})),
	);
}

const create = (sub: string) =>
	as(sub).send("post", "/projects", { name: "Next" });

describe("project quota", () => {
	it("lets a Free user create the plan's projects, then answers 403 PLAN_LIMIT_REACHED", async () => {
		const max = limitsFor("free").projects;
		for (let i = 0; i < max; i += 1) {
			expect((await create(USER)).status).toBe(201);
		}
		const blocked = await create(USER);
		expect(blocked.status).toBe(403);
		expect(blocked.body.error).toMatchObject({
			code: "PLAN_LIMIT_REACHED",
			details: { limit: "projects", max, used: max },
		});
		const clone = await as(USER).send(
			"post",
			`/projects/${(await as(USER).get("/projects")).body.items[0].id}/clone`,
		);
		expect(clone.status).toBe(403);
		expect(clone.body.error.code).toBe("PLAN_LIMIT_REACHED");
		expect(await ProjectModel.countDocuments({ owner: USER })).toBe(max);
	});

	it("applies the Pro limit, and Free again once Pro has expired", async () => {
		const max = limitsFor("pro").projects;
		await UserModel.updateOne({ sub: USER }, { plan: "pro" });
		await seedOwned(USER, max - 1);
		expect((await create(USER)).status).toBe(201);
		const blocked = await create(USER);
		expect(blocked.status).toBe(403);
		expect(blocked.body.error.details).toEqual({
			limit: "projects",
			max,
			used: max,
		});

		await ProjectModel.deleteMany({ owner: USER });
		await UserModel.updateOne(
			{ sub: USER },
			{ planExpiresAt: new Date(Date.now() - DAY_MS) },
		);
		await seedOwned(USER, limitsFor("free").projects);
		expect((await create(USER)).body.error.details.max).toBe(
			limitsFor("free").projects,
		);
	});

	it("counts only owned projects, not other users'", async () => {
		await seedOwned(OTHER, limitsFor("free").projects);
		expect((await create(USER)).status).toBe(201);
	});

	it("never exceeds the limit under concurrent creates", async () => {
		const max = limitsFor("free").projects;
		const results = await Promise.all(
			Array.from({ length: max + 5 }, () => create(USER)),
		);
		const statuses = results.map((res) => res.status);
		expect(statuses.filter((s) => s === 201)).toHaveLength(max);
		expect(statuses.filter((s) => s === 403)).toHaveLength(5);
		expect(await ProjectModel.countDocuments({ owner: USER })).toBe(max);
	});

	it("frees a slot when a project is deleted", async () => {
		const max = limitsFor("free").projects;
		for (let i = 0; i < max; i += 1) await create(USER);
		const [first] = (await as(USER).get("/projects")).body.items;
		await as(USER).send("delete", `/projects/${first.id}`);
		expect((await create(USER)).status).toBe(201);
		expect((await create(USER)).status).toBe(403);
	});
});
