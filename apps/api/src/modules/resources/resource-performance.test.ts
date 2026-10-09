import { performance } from "node:perf_hooks";
import { limitsFor } from "@localman/shared";
import { beforeEach, describe, expect, it } from "vitest";
import {
	as,
	useDashboardTestDb,
} from "../../test-support/dashboard-test-app.js";
import { UserModel } from "../users/user-model.js";
import { RecordModel } from "./record-model.js";
import {
	createProject,
	createResource,
	resourcesPath,
} from "./testing/resource-fixture.js";

const PRO = "acc_perf_pro";
const RESOURCES = 50;
const RECORDS = 100;
const BUDGET_MS = 3_000;

useDashboardTestDb();
beforeEach(async () => {
	await UserModel.create({ sub: PRO, username: "pro", plan: "pro" });
});

describe("generate_all performance", () => {
	it(`fills ${RESOURCES} resources × ${RECORDS} records within ${BUDGET_MS} ms`, async () => {
		expect(limitsFor("pro").resources).toBeGreaterThanOrEqual(RESOURCES);
		const project = await createProject(PRO);
		// 10 roots, each with a chain of 4 nested resources: parents matter.
		for (let root = 0; root < RESOURCES / 5; root += 1) {
			let parentId: string | null = null;
			for (let level = 0; level < 5; level += 1) {
				const created = await createResource(PRO, project, {
					name: `r${root}l${level}`,
					parentId,
					schema: [
						{ name: "createdAt", type: "Faker.js", fakerMethod: "date.past" },
						{ name: "name", type: "Faker.js", fakerMethod: "name.fullName" },
						{ name: "email", type: "Faker.js", fakerMethod: "internet.email" },
						{ name: "title", type: "String" },
						{ name: "rank", type: "Number" },
						{ name: "active", type: "Boolean" },
					],
				});
				parentId = created.id;
			}
		}

		const started = performance.now();
		const res = await as(PRO).send(
			"post",
			resourcesPath(project, "/generate_all"),
			{ count: RECORDS },
		);
		const elapsed = Math.round(performance.now() - started);
		process.stdout.write(
			`generate_all ${RESOURCES}x${RECORDS}: ${elapsed} ms\n`,
		);

		expect(res.status).toBe(200);
		expect(res.body.changes).toHaveLength(RESOURCES);
		expect(await RecordModel.countDocuments()).toBe(RESOURCES * RECORDS);
		expect(elapsed).toBeLessThan(BUDGET_MS);
	});
});
