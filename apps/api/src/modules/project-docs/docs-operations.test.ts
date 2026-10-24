import { beforeEach, describe, expect, it } from "vitest";
import {
	as,
	guest,
	useDashboardTestDb,
} from "../../test-support/dashboard-test-app.js";
import { ProjectModel } from "../projects/project-model.js";
import {
	createProject,
	createResource,
	resourcesPath,
} from "../resources/testing/resource-fixture.js";
import { UserModel } from "../users/user-model.js";

const ALICE = "acc_docs_alice";
const BOB = "acc_docs_bob";

useDashboardTestDb();
beforeEach(async () => {
	await UserModel.create([
		{ sub: ALICE, username: "alice" },
		{ sub: BOB, username: "bob" },
	]);
});

const slugOf = (url: string): string =>
	new URL(url).pathname.split("/")[2] ?? "";

async function published() {
	const project = await createProject(ALICE, "Shop");
	const users = await createResource(ALICE, project, {
		name: "users",
		schema: [
			{ name: "name", type: "String" },
			{ name: "email", type: "Faker.js", fakerMethod: "internet.email" },
		],
	});
	await createResource(ALICE, project, { name: "posts", parentId: users.id });
	const res = await as(ALICE).send("put", `/projects/${project}/docs`, {
		published: true,
	});
	expect(res.status, JSON.stringify(res.body)).toBe(200);
	return { project, users, slug: slugOf(res.body.url as string) };
}

describe("project docs", () => {
	it("are off until published, then readable without signing in", async () => {
		const project = await createProject(ALICE, "Shop");
		const off = await as(ALICE).get(`/projects/${project}/docs`);
		expect(off.body).toEqual({ published: false, url: null });
		const { slug } = await published();
		const docs = await guest().get(`/public/docs/${slug}`);
		expect(docs.status).toBe(200);
		expect(docs.body.name).toBe("Shop");
		const [users, posts] = docs.body.resources;
		expect(users).toMatchObject({
			name: "users",
			depth: 0,
			fields: [
				{ name: "name", type: "String", detail: null },
				{ name: "email", type: "Faker.js", detail: "internet.email" },
			],
			example: { id: "1", name: "", email: "" },
		});
		expect(users.endpoints).toContainEqual({ method: "GET", path: "/users" });
		expect(users.endpoints).toContainEqual({
			method: "PATCH",
			path: "/users/{id}",
		});
		expect(posts).toMatchObject({ name: "posts", depth: 1 });
		expect(posts.endpoints).toContainEqual({
			method: "GET",
			path: "/users/{userId}/posts",
		});
	});

	it("never carry the project secret", async () => {
		const { project, slug } = await published();
		const stored = await ProjectModel.findById(project).lean();
		const docs = await guest().get(`/public/docs/${slug}`);
		expect(JSON.stringify(docs.body)).not.toContain(stored?.secret ?? "?");
	});

	it("follow the schema at once, with a new version", async () => {
		const { project, users, slug } = await published();
		const before = (await guest().get(`/public/docs/${slug}`)).body;
		await as(ALICE).send("put", resourcesPath(project, `/${users.id}`), {
			name: "members",
			schema: [{ name: "age", type: "Number" }],
		});
		const after = (await guest().get(`/public/docs/${slug}`)).body;
		expect(after.version).not.toBe(before.version);
		expect(after.resources[0]).toMatchObject({
			name: "members",
			fields: [{ name: "age", type: "Number", detail: null }],
			example: { id: "1", age: 0 },
		});
	});

	it("stop working when taken down, and come back under a new link", async () => {
		const { project, slug } = await published();
		const down = await as(ALICE).send("put", `/projects/${project}/docs`, {
			published: false,
		});
		expect(down.body).toEqual({ published: false, url: null });
		expect((await guest().get(`/public/docs/${slug}`)).status).toBe(404);
		const again = await as(ALICE).send("put", `/projects/${project}/docs`, {
			published: true,
		});
		expect(slugOf(again.body.url)).not.toBe(slug);
	});

	it("are published by members only, and unknown links answer 404", async () => {
		const { project } = await published();
		const res = await as(BOB).send("put", `/projects/${project}/docs`, {
			published: true,
		});
		expect(res.status).toBe(404);
		expect((await guest().get("/public/docs/not-a-slug")).status).toBe(404);
		expect(
			(await guest().get(`/public/docs/${"A".repeat(32)}`)).body.error.code,
		).toBe("DOCS_NOT_FOUND");
	});
});
