import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import {
	as,
	guest,
	testApp,
	useDashboardTestDb,
} from "../../test-support/dashboard-test-app.js";
import { UserModel } from "../users/user-model.js";
import {
	createProject,
	createResource,
	readData,
	resourcesPath,
} from "./testing/resource-fixture.js";

const ALICE = "acc_body_alice";

useDashboardTestDb();
beforeEach(async () => {
	await UserModel.create({ sub: ALICE, username: "alice" });
});

/** `count` records of about `bytes` each. */
const records = (count: number, bytes: number) =>
	Array.from({ length: count }, () => ({ text: "x".repeat(bytes) }));

describe("JSON body limits", () => {
	it("lets PUT data carry a whole resource and nothing larger", async () => {
		const project = await createProject(ALICE);
		const users = await createResource(ALICE, project, { name: "users" });
		const path = resourcesPath(project, `/${users.id}/data`);

		const big = { data: records(1000, 1_500) };
		expect(JSON.stringify(big).length).toBeGreaterThan(1_500_000);
		const ok = await as(ALICE).send("put", path, big);
		expect(ok.status, JSON.stringify(ok.body).slice(0, 200)).toBe(200);
		expect(await readData(ALICE, project, users.id)).toHaveLength(1000);

		const huge = await as(ALICE).send("put", path, {
			data: records(100, 30_000),
		});
		expect(huge.status).toBe(413);
		expect(huge.body.error.code).toBe("PAYLOAD_TOO_LARGE");
	});

	it("keeps 100 KB everywhere else, with the CSRF guard before parsing", async () => {
		const project = await createProject(ALICE);
		const users = await createResource(ALICE, project, { name: "users" });
		const padded = { name: "users", template: { blob: "x".repeat(150_000) } };
		const update = await as(ALICE).send(
			"put",
			resourcesPath(project, `/${users.id}`),
			padded,
		);
		expect(update.status).toBe(413);
		expect(update.body.error.code).toBe("PAYLOAD_TOO_LARGE");
		const generate = await as(ALICE).send(
			"post",
			resourcesPath(project, `/${users.id}/generate`),
			{ count: 1, pad: "x".repeat(150_000) },
		);
		expect(generate.status).toBe(413);

		// Malformed JSON: a parser running first would answer 400, not 403.
		const forged = await request(testApp)
			.put(`/api/v1${resourcesPath(project, `/${users.id}/data`)}`)
			.set("x-test-sub", ALICE)
			.set("origin", "https://evil.test")
			.set("content-type", "application/json")
			.send('{"data": [');
		expect(forged.status).toBe(403);
		expect(forged.body.error.code).toBe("CSRF_REJECTED");
	});
	it("answers 401 to an anonymous caller before reading the large body", async () => {
		const project = await createProject(ALICE);
		const users = await createResource(ALICE, project, { name: "users" });
		const path = `/api/v1${resourcesPath(project, `/${users.id}/data`)}`;
		// Malformed JSON: parsing first would answer 400, not 401.
		const malformed = await request(testApp)
			.put(path)
			.set("origin", "https://localman.test")
			.set("content-type", "application/json")
			.send('{"data": [');
		expect(malformed.status).toBe(401);
		expect(malformed.body.error.code).toBe("UNAUTHENTICATED");
		const big = await guest().send(
			"put",
			resourcesPath(project, `/${users.id}/data`),
			{
				data: records(1000, 1_500),
			},
		);
		expect(big.status).toBe(401);
	});
});
