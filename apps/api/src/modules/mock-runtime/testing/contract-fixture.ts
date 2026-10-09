import { expect } from "vitest";
import { as } from "../../../test-support/dashboard-test-app.js";
import {
	type ResourceBody,
	createResource,
	resourcesPath,
} from "../../resources/testing/resource-fixture.js";
import { OWNER, createMockProject } from "./mock-test-kit.js";

/** TEST ONLY. Tasks of user 1 (24) and user 2 (6) in the wiki's shape. */
export const USER_1_TASKS = 24;
export const ALL_TASKS = 30;

export interface ContractProject {
	readonly secret: string;
	readonly users: ResourceBody;
	readonly tasks: ResourceBody;
}

async function putData(
	projectId: string,
	resourceId: string,
	data: object[],
): Promise<void> {
	const res = await as(OWNER).send(
		"put",
		resourcesPath(projectId, `/${resourceId}/data`),
		{ data },
	);
	expect(res.status, JSON.stringify(res.body)).toBe(200);
}

/**
 * TEST ONLY. The project of the wiki examples: `users` and nested `tasks`
 * (`title` from `lorem.sentences`, `completed` from `datatype.boolean`),
 * with known data: task `i` of user 1 is "hello world i" when `i` is a
 * multiple of 3 (else "task i") and completed when `i` is even.
 */
export async function contractProject(
	taskEndpoints?: object[],
): Promise<ContractProject> {
	const project = await createMockProject();
	const users = await createResource(OWNER, project.id, {
		name: "users",
		schema: [{ name: "name", type: "Faker.js", fakerMethod: "name.fullName" }],
	});
	const tasks = await createResource(OWNER, project.id, {
		name: "tasks",
		parentId: users.id,
		schema: [
			{ name: "title", type: "Faker.js", fakerMethod: "lorem.sentences" },
			{ name: "completed", type: "Faker.js", fakerMethod: "datatype.boolean" },
		],
		...(taskEndpoints ? { endpoints: taskEndpoints } : {}),
	});
	await putData(project.id, users.id, [
		{ name: "Ada" },
		{ name: "Linus" },
		{ name: "Grace" },
	]);
	await putData(
		project.id,
		tasks.id,
		Array.from({ length: ALL_TASKS }, (_, index) => {
			const i = index + 1;
			return {
				userId: i <= USER_1_TASKS ? "1" : "2",
				title: i % 3 === 0 ? `hello world ${i}` : `task ${i}`,
				completed: i % 2 === 0,
			};
		}),
	);
	return { secret: project.secret, users, tasks };
}
