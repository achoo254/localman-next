import { LIMITS } from "@localman/shared";
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
	it("lets a user create the allowed projects, then answers 403 PLAN_LIMIT_REACHED", async () => {
		const max = LIMITS.projects;
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

	it("counts only owned projects, not other users'", async () => {
		await seedOwned(OTHER, LIMITS.projects);
		expect((await create(USER)).status).toBe(201);
	});

	it("never exceeds the limit under concurrent creates", async () => {
		const max = LIMITS.projects;
		const results = await Promise.all(
			Array.from({ length: max + 5 }, () => create(USER)),
		);
		const statuses = results.map((res) => res.status);
		expect(statuses.filter((s) => s === 201)).toHaveLength(max);
		expect(statuses.filter((s) => s === 403)).toHaveLength(5);
		expect(await ProjectModel.countDocuments({ owner: USER })).toBe(max);
	});

	it("frees a slot when a project is deleted", async () => {
		const max = LIMITS.projects;
		for (let i = 0; i < max; i += 1) await create(USER);
		const [first] = (await as(USER).get("/projects")).body.items;
		await as(USER).send("delete", `/projects/${first.id}`);
		expect((await create(USER)).status).toBe(201);
		expect((await create(USER)).status).toBe(403);
	});
});
