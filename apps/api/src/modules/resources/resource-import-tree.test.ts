import { beforeEach, describe, expect, it } from "vitest";
import {
	as,
	useDashboardTestDb,
} from "../../test-support/dashboard-test-app.js";
import { UserModel } from "../users/user-model.js";
import { dataOf, importAs } from "./testing/import-fixture.js";
import { PETSTORE_OPENAPI } from "./testing/petstore-openapi.js";
import { createProject, resourcesPath } from "./testing/resource-fixture.js";

const ALICE = "acc_alice";
useDashboardTestDb(() => ({ mockBaseDomain: "mock.test" }));
beforeEach(async () => {
	await UserModel.create({ sub: ALICE, username: "alice" });
});

const USERS = [
	{ id: 1, name: "Ada", email: "ada@example.com", age: 36 },
	{ id: 2, name: "Linus", email: "linus@example.com", age: 54 },
	{ id: 3, name: "Grace", email: "grace@example.com", age: 85 },
];

describe("import_resources (POST …/resources/import)", () => {
	it("previews pasted JSON without creating anything, then creates it with its 3 records", async () => {
		const projectId = await createProject(ALICE);
		const body = {
			format: "json",
			input: JSON.stringify(USERS),
			name: "users",
		};
		const preview = await importAs(ALICE, projectId, body, true);
		expect(preview.status, JSON.stringify(preview.body)).toBe(200);
		expect(preview.body).toMatchObject({
			dryRun: true,
			created: [],
			resourcesLeft: 10,
			schemaNames: [],
			selectedSchema: null,
		});
		const [users] = preview.body.resources;
		expect(users).toMatchObject({
			name: "users",
			parentName: null,
			sampleKind: "source",
			recordCount: 3,
			truncated: false,
			fields: [
				{
					name: "name",
					type: "Faker.js",
					fakerMethod: "name.fullName",
					suggested: true,
				},
				{
					name: "email",
					type: "Faker.js",
					fakerMethod: "internet.email",
					suggested: true,
				},
				{ name: "age", type: "Number", suggested: false },
			],
		});
		expect(users.sample).toHaveLength(3);
		expect((await as(ALICE).get(resourcesPath(projectId))).body.items).toEqual(
			[],
		);

		const created = await importAs(ALICE, projectId, body);
		expect(created.status, JSON.stringify(created.body)).toBe(200);
		expect(created.body.resourcesLeft).toBe(9);
		const [resource] = created.body.created;
		expect(resource).toMatchObject({ name: "users", count: 3, revision: 0 });
		expect(await dataOf(ALICE, projectId, resource.id)).toEqual(
			USERS.map((user) => ({ ...user, id: String(user.id) })),
		);
	});

	it("imports the petstore schema as a resource tree linked by a Child Resource field", async () => {
		const projectId = await createProject(ALICE);
		const base = { format: "openapi", input: PETSTORE_OPENAPI };
		const first = await importAs(ALICE, projectId, base, true);
		expect(first.status, JSON.stringify(first.body)).toBe(200);
		expect(first.body.selectedSchema).toBe("Order");
		expect(first.body.schemaNames).toEqual(
			expect.arrayContaining(["Order", "Customer", "Address", "Pet", "Tag"]),
		);

		const body = {
			...base,
			schema: "Pet",
			name: "pets",
			names: { Tag: "tags" },
		};
		const preview = await importAs(ALICE, projectId, body, true);
		expect(preview.body.relatedCount).toBe(1);
		const [pets, tags] = preview.body.resources;
		expect(pets).toMatchObject({
			key: "Pet",
			name: "pets",
			parentName: null,
			sampleKind: "generated",
			recordCount: 0,
		});
		expect(pets.sample).toHaveLength(5);
		expect(pets.fields).toContainEqual({
			name: "tags",
			type: "Child Resource",
			childName: "tags",
			suggested: false,
		});
		expect(tags).toMatchObject({
			key: "Tag",
			name: "tags",
			parentName: "pets",
		});
		expect(tags.sample[0]).toHaveProperty("petId");

		const res = await importAs(ALICE, projectId, body);
		expect(res.status, JSON.stringify(res.body)).toBe(200);
		const [pet, tag] = res.body.created;
		expect(tag).toMatchObject({
			parentId: pet.id,
			parentKey: "petId",
			count: 0,
		});
		expect(pet.schema).toContainEqual({
			name: "tags",
			type: "Child Resource",
			childId: tag.id,
		});

		const alone = await importAs(
			ALICE,
			projectId,
			{ ...base, schema: "Pet", name: "pets2", includeRelated: false },
			true,
		);
		expect(alone.body.resources).toHaveLength(1);
		expect(alone.body.relatedCount).toBe(1);
		expect(alone.body.resources[0].fields).toContainEqual({
			name: "tags",
			type: "Array",
			suggested: false,
		});
	});

	it("reads CSV with a byte-order mark and commas inside quotes", async () => {
		const projectId = await createProject(ALICE);
		const csv = '﻿name,city,score\n"Doe, Jane","Hanoi",9\nAn,Hue,7\n';
		const res = await importAs(ALICE, projectId, {
			format: "csv",
			input: csv,
			name: "people",
		});
		expect(res.status, JSON.stringify(res.body)).toBe(200);
		const [people] = res.body.created;
		expect(people.schema.map((f: { name: string }) => f.name)).toEqual([
			"name",
			"city",
			"score",
		]);
		expect(await dataOf(ALICE, projectId, people.id)).toEqual([
			{ id: "1", name: "Doe, Jane", city: "Hanoi", score: 9 },
			{ id: "2", name: "An", city: "Hue", score: 7 },
		]);
	});
});
