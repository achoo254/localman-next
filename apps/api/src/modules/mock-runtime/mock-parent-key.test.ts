import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { ResourceModel } from "../resources/resource-model.js";
import {
	createResource,
	generate,
	resourcesPath,
} from "../resources/testing/resource-fixture.js";
import {
	OWNER,
	createMockProject,
	useMockTestKit,
} from "./testing/mock-test-kit.js";

const kit = useMockTestKit();

async function peopleWithQuizzes(stored: boolean) {
	const project = await createMockProject();
	const people = await createResource(OWNER, project.id, { name: "people" });
	const quizzes = await createResource(OWNER, project.id, {
		name: "quizzes",
		parentId: people.id,
		schema: [{ name: "title", type: "String" }],
	});
	if (!stored) {
		await ResourceModel.updateOne(
			{ _id: new Types.ObjectId(quizzes.id) },
			{ $unset: { parentKey: 1 } },
		);
	}
	await generate(OWNER, project.id, people.id, 2);
	await generate(OWNER, project.id, quizzes.id, 6);
	return { project, quizzes, mock: kit.client(project.secret) };
}

describe("mock Parent ID", () => {
	it("filters, reads and writes with the stored key", async () => {
		const { mock } = await peopleWithQuizzes(true);
		const first = await mock.get("/quizzes?personId=1");
		const second = await mock.get("/quizzes?personId=2");
		expect(first.status).toBe(200);
		expect(first.body.length + second.body.length).toBe(6);
		for (const quiz of first.body) expect(quiz.personId).toBe("1");
		for (const quiz of second.body) expect(quiz.personId).toBe("2");
		expect((await mock.get("/quizzes")).body[0]).not.toHaveProperty("peopleId");
		const created = await mock.call("post", "/quizzes", {
			personId: "2",
			title: "flat",
		});
		expect(created.status, JSON.stringify(created.body)).toBe(201);
		expect(created.body.personId).toBe("2");
	});

	it("keeps the old key for a resource stored before keys were", async () => {
		const { mock } = await peopleWithQuizzes(false);
		const first = await mock.get("/quizzes?peopleId=1");
		const second = await mock.get("/quizzes?peopleId=2");
		expect(first.body.length + second.body.length).toBe(6);
		for (const quiz of first.body) expect(quiz.peopleId).toBe("1");
		expect((await mock.get("/quizzes")).body[0]).not.toHaveProperty("personId");
	});

	it("names the parent placeholder of mock URLs after the child's key", async () => {
		const { project, quizzes } = await peopleWithQuizzes(true);
		await as(OWNER).send("put", resourcesPath(project.id, `/${quizzes.id}`), {
			name: "quizzes",
			parentKey: "ownerId",
		});
		const urls = await as(OWNER).get(`/projects/${project.id}/mock-urls`);
		const entry = urls.body.resources.find(
			(r: { id: string }) => r.id === quizzes.id,
		);
		expect(entry.collectionUrl).toMatch(/\/people\/\{ownerId\}\/quizzes$/);
		const mock = kit.client(project.secret);
		const first = await mock.get("/quizzes?ownerId=1");
		const second = await mock.get("/quizzes?ownerId=2");
		expect(first.body.length + second.body.length).toBe(6);
		for (const quiz of second.body) expect(quiz.ownerId).toBe("2");
	});
});
