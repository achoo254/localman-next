import {
	OWNER,
	createMockProject,
} from "../../mock-runtime/testing/mock-test-kit.js";
import {
	type ResourceBody,
	createResource,
} from "../../resources/testing/resource-fixture.js";
import { putData } from "./mock-mcp-test-client.js";

/** TEST ONLY. */
export interface Blog {
	readonly id: string;
	readonly secret: string;
	readonly users: ResourceBody;
	readonly posts: ResourceBody;
}

/** TEST ONLY. users (Ada, Linus, Grace, Alan) → posts (two of user 2) → comments. */
export async function blog(prefix = ""): Promise<Blog> {
	const project = await createMockProject(prefix);
	const users = await createResource(OWNER, project.id, {
		name: "users",
		schema: [
			{ name: "name", type: "String" },
			{ name: "age", type: "Number" },
		],
	});
	const posts = await createResource(OWNER, project.id, {
		name: "posts",
		parentId: users.id,
		schema: [{ name: "title", type: "String" }],
	});
	await createResource(OWNER, project.id, {
		name: "comments",
		parentId: posts.id,
		schema: [{ name: "body", type: "String" }],
	});
	await putData(OWNER, project.id, users.id, [
		{ name: "Ada", age: 36 },
		{ name: "Linus", age: 54 },
		{ name: "Grace", age: 85 },
		{ name: "Alan", age: 41 },
	]);
	await putData(OWNER, project.id, posts.id, [
		{ userId: "2", title: "Kernel" },
		{ userId: "2", title: "Git" },
	]);
	return { ...project, users, posts };
}
