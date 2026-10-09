import { describe, expect, it } from "vitest";
import {
	DEFAULT_RUNTIME_SETTINGS,
	type RuntimeSettings,
} from "../../config/runtime-settings.js";
import { as } from "../../test-support/dashboard-test-app.js";
import {
	BOB,
	OWNER,
	addMember,
	createProject,
	useCollaboratorTestDb,
} from "../collaborators/testing/collaborator-fixture.js";
import { createResource, resourcesPath } from "./testing/resource-fixture.js";

const window = (max: number) => ({ max, windowMs: 60_000 });
const limits: RuntimeSettings["heavyOperationRateLimit"] = {
	generate: { perUser: window(2), perProject: window(3) },
	replaceData: { perUser: window(2), perProject: window(10) },
	clone: { perUser: window(2), perProject: window(10) },
	reset: { perUser: window(2), perProject: window(10) },
	import: { perUser: window(2), perProject: window(10) },
	suggestFaker: { perUser: window(2) },
};

useCollaboratorTestDb(() => ({
	...DEFAULT_RUNTIME_SETTINGS,
	heavyOperationRateLimit: limits,
}));

async function statuses(send: () => Promise<{ status: number }>, times = 3) {
	const seen: number[] = [];
	for (let i = 0; i < times; i += 1) seen.push((await send()).status);
	return seen;
}

async function projectWithUsers() {
	const projectId = await createProject(OWNER);
	const users = await createResource(OWNER, projectId, { name: "users" });
	return { projectId, usersId: users.id };
}

describe("heavy dashboard operations", () => {
	it("limit generating per account, previews aside", async () => {
		const { projectId, usersId } = await projectWithUsers();
		const generate = (dryRun = false) =>
			as(OWNER).send(
				"post",
				resourcesPath(
					projectId,
					`/${usersId}/generate${dryRun ? "?dryRun=true" : ""}`,
				),
				{ count: 1 },
			);
		expect(await statuses(() => generate(true))).toEqual([200, 200, 200]);
		expect((await generate()).status).toBe(200);
		const all = await as(OWNER).send(
			"post",
			resourcesPath(projectId, "/generate_all"),
			{},
		);
		expect(all.status).toBe(200);
		const limited = await generate();
		expect(limited.status).toBe(429);
		expect(limited.body.error.code).toBe("RATE_LIMITED");
	});

	it("limit a project across its members", async () => {
		const { projectId, usersId } = await projectWithUsers();
		await addMember(OWNER, projectId, BOB, "bob");
		const generate = (sub: string) =>
			as(sub).send("post", resourcesPath(projectId, `/${usersId}/generate`), {
				count: 1,
			});
		expect((await generate(OWNER)).status).toBe(200);
		expect((await generate(OWNER)).status).toBe(200);
		expect((await generate(BOB)).status).toBe(200);
		expect((await generate(BOB)).status).toBe(429);
	});

	it("do not let a member over the account limit spend the project's budget", async () => {
		const { projectId, usersId } = await projectWithUsers();
		await addMember(OWNER, projectId, BOB, "bob");
		const generate = (sub: string) =>
			as(sub).send("post", resourcesPath(projectId, `/${usersId}/generate`), {
				count: 1,
			});
		expect(await statuses(() => generate(BOB), 5)).toEqual([
			200, 200, 429, 429, 429,
		]);
		expect((await generate(OWNER)).status).toBe(200);
	});

	it("limit replacing data, resetting and cloning", async () => {
		const { projectId, usersId } = await projectWithUsers();
		const put = () =>
			as(OWNER).send("put", resourcesPath(projectId, `/${usersId}/data`), {
				data: [{ name: "a" }],
			});
		expect(await statuses(put)).toEqual([200, 200, 429]);
		const reset = () =>
			as(OWNER).send("post", resourcesPath(projectId, "/reset_all"), {});
		expect(await statuses(reset)).toEqual([200, 200, 429]);
		const clone = () => as(OWNER).send("post", `/projects/${projectId}/clone`);
		const cloned = await statuses(clone);
		expect(cloned.at(-1)).toBe(429);
		expect(cloned.slice(0, 2).every((status) => status !== 429)).toBe(true);
	});

	it("limit imports, previews included, and Faker suggestions", async () => {
		const { projectId } = await projectWithUsers();
		const preview = () =>
			as(OWNER).send("post", resourcesPath(projectId, "/import?dryRun=true"), {
				format: "json",
				input: '[{"name":"Ada"}]',
				name: "people",
			});
		expect(await statuses(preview)).toEqual([200, 200, 429]);
		const suggest = () =>
			as(BOB).send("post", "/faker-methods/suggestions", {
				fields: [{ name: "email" }],
			});
		const suggested = await statuses(suggest);
		expect(suggested).toEqual([200, 200, 429]);
	});
});
