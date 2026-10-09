import { MAX_METHOD_REFERENCES, MAX_RECORD_BYTES } from "@localman/shared";
import { beforeEach, describe, expect, it } from "vitest";
import {
	as,
	useDashboardTestDb,
} from "../../test-support/dashboard-test-app.js";
import { UserModel } from "../users/user-model.js";
import { RecordModel } from "./record-model.js";
import { ResourceModel } from "./resource-model.js";
import {
	createProject,
	createResource,
	generate,
	readData,
	resourcesPath,
} from "./testing/resource-fixture.js";

const ALICE = "acc_limits_alice";

useDashboardTestDb();
beforeEach(async () => {
	await UserModel.create({ sub: ALICE, username: "alice" });
});

const putData = (project: string, id: string, data: unknown[]) =>
	as(ALICE).send("put", resourcesPath(project, `/${id}/data`), { data });

describe("data size limits", () => {
	it("refuses a template with too many Faker calls before storing it", async () => {
		const project = await createProject(ALICE);
		const bomb = Array.from({ length: 1999 }, () => "$lorem.paragraphs");
		const res = await as(ALICE).send("post", resourcesPath(project), {
			name: "bomb",
			template: { items: bomb },
		});
		expect(res.status).toBe(400);
		expect(res.body.error.message).toContain(
			`at most ${MAX_METHOD_REFERENCES} Faker methods`,
		);
	});

	it("refuses at save time a template whose worst record passes the cap", async () => {
		const project = await createProject(ALICE);
		const paragraphs = Array.from(
			{ length: MAX_METHOD_REFERENCES },
			() => "$lorem.paragraphs",
		);
		const res = await as(ALICE).send("post", resourcesPath(project), {
			name: "heavy",
			template: { items: paragraphs },
		});
		expect(res.status).toBe(400);
		expect(res.body.error.code).toBe("TEMPLATE_TOO_LARGE");
		expect(res.body.error.details.estimatedBytes).toBeGreaterThan(
			MAX_RECORD_BYTES,
		);
		const fits = await as(ALICE).send("post", resourcesPath(project), {
			name: "light",
			template: { items: paragraphs.slice(0, 10) },
		});
		expect(fits.status).toBe(201);
	});

	it("still stops a stored oversized template early when generating", async () => {
		const project = await createProject(ALICE);
		const heavy = await createResource(ALICE, project, { name: "heavy" });
		// A template stored before the save-time estimate existed.
		await ResourceModel.updateOne(
			{ _id: heavy.id },
			{
				template: {
					items: Array.from({ length: 1999 }, () => "$lorem.paragraphs"),
				},
			},
		);
		const rssBefore = process.memoryUsage().rss;
		const started = performance.now();
		const res = await generate(ALICE, project, heavy.id, 100);
		expect(performance.now() - started).toBeLessThan(1_000);
		expect(process.memoryUsage().rss - rssBefore).toBeLessThan(
			64 * 1024 * 1024,
		);
		expect(res.status).toBe(413);
		expect(res.body.error.details).toMatchObject({
			limit: "record",
			maxBytes: MAX_RECORD_BYTES,
			resourceId: heavy.id,
			name: "heavy",
		});
		expect(res.body.error.details.actualBytes).toBeGreaterThan(
			MAX_RECORD_BYTES,
		);
		expect(await RecordModel.countDocuments()).toBe(0);
	});

	it("refuses a resource whose records together pass 2 MB", async () => {
		const project = await createProject(ALICE);
		const wide = await createResource(ALICE, project, {
			name: "wide",
			template: { blob: "x".repeat(30_000) },
		});
		const res = await generate(ALICE, project, wide.id, 100);
		expect(res.status).toBe(413);
		expect(res.body.error.details).toMatchObject({
			limit: "resource",
			resourceId: wide.id,
			name: "wide",
		});
		const fits = await generate(ALICE, project, wide.id, 60);
		expect(fits.status).toBe(200);
		const all = await as(ALICE).send(
			"post",
			resourcesPath(project, "/generate_all"),
			{ count: 100 },
		);
		expect(all.status).toBe(413);
		expect(all.body.error.details).toMatchObject({
			resourceId: wide.id,
			name: "wide",
		});
		expect(await RecordModel.countDocuments()).toBe(60);
	});

	it("refuses an oversized pasted record", async () => {
		const project = await createProject(ALICE);
		const users = await createResource(ALICE, project, { name: "users" });
		const res = await putData(project, users.id, [
			{ blob: "x".repeat(MAX_RECORD_BYTES) },
		]);
		expect(res.status).toBe(413);
		expect(res.body.error.details.limit).toBe("record");
	});
});

describe("pasted record rules", () => {
	it("refuses ids without a letter or digit and ignores huge ids for numbering", async () => {
		const project = await createProject(ALICE);
		const users = await createResource(ALICE, project, { name: "users" });
		for (const id of [".", "..", "-", "~"]) {
			expect((await putData(project, users.id, [{ id }])).status, id).toBe(400);
		}
		expect(
			(await putData(project, users.id, [{ id: 5_000_000_000 }, {}])).status,
		).toBe(200);
		expect(
			(await readData(ALICE, project, users.id)).map((record) => record.id),
		).toEqual(["5000000000", "1"]);
	});

	it("reports the exact JSON problem with its path", async () => {
		const project = await createProject(ALICE);
		const users = await createResource(ALICE, project, { name: "users" });
		const res = await putData(project, users.id, [{ a: { constructor: 1 } }]);
		expect(res.status).toBe(400);
		expect(res.body.error.details).toEqual([
			{
				path: "data.0.a.constructor",
				message: 'Key "constructor" is not allowed',
			},
		]);
	});

	it("never hides a value behind the generated parent id", async () => {
		const project = await createProject(ALICE);
		const users = await createResource(ALICE, project, { name: "users" });
		const posts = await createResource(ALICE, project, {
			name: "posts",
			parentId: users.id,
		});
		await generate(ALICE, project, users.id, 2);
		const explicitNull = await putData(project, posts.id, [{ userId: null }]);
		expect(explicitNull.status).toBe(400);
		expect(explicitNull.body.error.details[0].path).toBe("data.0.userId");

		const shadowing = await as(ALICE).send(
			"put",
			resourcesPath(project, `/${posts.id}`),
			{ name: "posts", template: { userId: "$datatype.uuid" } },
		);
		expect(shadowing.status).toBe(400);

		await putData(project, posts.id, [{ authorId: "kept" }]);
		const rename = await as(ALICE).send(
			"put",
			resourcesPath(project, `/${users.id}`),
			{ name: "authors" },
		);
		expect(rename.status).toBe(409);
		expect(rename.body.error.code).toBe("FIELD_CONFLICT");
		expect((await readData(ALICE, project, posts.id))[0]?.authorId).toBe(
			"kept",
		);
	});
});
