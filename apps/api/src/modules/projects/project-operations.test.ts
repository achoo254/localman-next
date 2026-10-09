import type { Types } from "mongoose";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	DEFAULT_RUNTIME_SETTINGS,
	configureRuntime,
} from "../../config/runtime-settings.js";
import {
	as,
	guest,
	useDashboardTestDb,
} from "../../test-support/dashboard-test-app.js";
import { UserModel } from "../users/user-model.js";
import { registerProjectDependent } from "./project-dependents.js";
import { ProjectModel } from "./project-model.js";

const ALICE = "acc_alice";
const BOB = "acc_bob";

useDashboardTestDb(() => ({ mockBaseDomain: "mock.test" }));

/** In-memory stand-in for a dependent module: rows keyed by project id. */
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
			sub: ALICE,
			username: "alice",
			name: "Alice",
			picture: "https://cdn.test/a.png",
		},
		{ sub: BOB, username: "bob" },
	]);
});
afterEach(() => unregister());

async function createAs(sub: string, name = "Demo", prefix = "") {
	const res = await as(sub).send("post", "/projects", { name, prefix });
	expect(res.status).toBe(201);
	return res.body as { id: string; secret: string; name: string };
}

describe("project operations", () => {
	it("create a project with a DNS-safe secret, a normalized prefix and the mock URL", async () => {
		const res = await as(ALICE).send("post", "/projects", {
			name: "  Dự án Một ",
			prefix: "api/v1/",
		});
		expect(res.status).toBe(201);
		expect(res.body).toMatchObject({
			name: "Dự án Một",
			prefix: "/api/v1",
			role: "owner",
			owner: {
				sub: ALICE,
				username: "alice",
				name: "Alice",
				picture: "https://cdn.test/a.png",
			},
		});
		expect(res.body.secret).toMatch(/^[a-z0-9]{24}$/);
		expect(res.body.mockBaseUrl).toBe(
			`https://${res.body.secret}.mock.test/api/v1`,
		);
		expect(Date.parse(res.body.createdAt)).not.toBeNaN();
	});

	it("build http mock URLs for a localhost mock domain", async () => {
		configureRuntime({
			...DEFAULT_RUNTIME_SETTINGS,
			mockBaseDomain: "localhost:4100",
		});
		const project = await createAs(ALICE, "Local", "/v1");
		const [listed] = (await as(ALICE).get("/projects")).body.items;
		expect(listed.mockBaseUrl).toBe(
			`http://${project.secret}.localhost:4100/v1`,
		);
	});

	it("reject invalid names and prefixes, and anonymous callers", async () => {
		for (const body of [
			{ name: "" },
			{ name: "a<b>" },
			{ name: "(copy)" },
			{ name: "ok", prefix: "/a b" },
		]) {
			const res = await as(ALICE).send("post", "/projects", body);
			expect(res.status).toBe(400);
			expect(res.body.error.code).toBe("VALIDATION_ERROR");
		}
		expect((await guest().get("/projects")).status).toBe(401);
	});

	it("list only the caller's projects, oldest first", async () => {
		await createAs(ALICE, "First");
		await createAs(ALICE, "Second");
		await createAs(BOB, "Bob project");
		const res = await as(ALICE).get("/projects");
		expect(res.status).toBe(200);
		expect(res.body.items.map((p: { name: string }) => p.name)).toEqual([
			"First",
			"Second",
		]);
	});

	it("update name and prefix, keeping the secret", async () => {
		const project = await createAs(ALICE);
		const res = await as(ALICE).send("put", `/projects/${project.id}`, {
			name: "Renamed",
			prefix: "/x//y/",
		});
		expect(res.status).toBe(200);
		expect(res.body).toMatchObject({
			name: "Renamed",
			prefix: "/x/y",
			secret: project.secret,
		});
	});

	it("clone with a new secret, a (copy) name and the dependents' data", async () => {
		const source = await createAs(ALICE, "Shop");
		stubRows.set(source.id, ["users", "orders"]);
		const res = await as(ALICE).send("post", `/projects/${source.id}/clone`);
		expect(res.status).toBe(201);
		expect(res.body.name).toBe("Shop (copy)");
		expect(res.body.secret).not.toBe(source.secret);
		expect(res.body.id).not.toBe(source.id);
		expect(stubRows.get(res.body.id)).toEqual(["users", "orders"]);
		// The clone is editable as is: its name passes validation.
		const edit = await as(ALICE).send("put", `/projects/${res.body.id}`, {
			name: res.body.name,
		});
		expect(edit.status).toBe(200);
	});

	it("preview a delete with dryRun, then cascade it", async () => {
		const project = await createAs(ALICE);
		stubRows.set(project.id, ["users"]);
		const preview = await as(ALICE).send(
			"delete",
			`/projects/${project.id}?dryRun=true`,
		);
		expect(preview.status).toBe(200);
		expect(preview.body).toEqual({
			id: project.id,
			deleted: false,
			dryRun: true,
			dependents: [
				{ kind: "resources", count: 0 },
				{ kind: "records", count: 0 },
				{ kind: "stub-rows", count: 1 },
			],
		});
		expect(await ProjectModel.countDocuments()).toBe(1);

		const real = await as(ALICE).send("delete", `/projects/${project.id}`);
		expect(real.body).toMatchObject({ deleted: true, dryRun: false });
		expect(await ProjectModel.countDocuments()).toBe(0);
		expect(stubRows.has(project.id)).toBe(false);
	});

	it("answer 404 to another user for every action, without changing anything", async () => {
		const project = await createAs(ALICE);
		const bob = as(BOB);
		const attempts = [
			bob.send("put", `/projects/${project.id}`, { name: "Hijacked" }),
			bob.send("delete", `/projects/${project.id}?dryRun=true`),
			bob.send("delete", `/projects/${project.id}`),
			bob.send("post", `/projects/${project.id}/clone`),
			bob.send("put", "/projects/not-an-id", { name: "x" }),
			bob.send("delete", "/projects/0123456789abcdef01234567"),
		];
		for (const res of await Promise.all(attempts)) {
			expect(res.status).toBe(404);
			expect(res.body.error.code).toBe("NOT_FOUND");
		}
		expect((await as(BOB).get("/projects")).body.items).toEqual([]);
		const stored = await ProjectModel.findById(project.id).lean();
		expect(stored?.name).toBe("Demo");
		expect(await ProjectModel.countDocuments()).toBe(1);
	});
});
