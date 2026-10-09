import { expect, test } from "@playwright/test";
import {
	fetchFromPage,
	firstWithRecords,
	recordsOf,
} from "../support/mock-fetch.js";
import { createProject, openProject } from "../support/projects-ui.js";
import {
	createResource,
	generateAll,
	mockUrlOf,
	nestUnder,
} from "../support/resources-ui.js";
import { signIn, uniqueSuffix, uniqueUsername } from "../support/session.js";

test("a new user signs up, builds users and posts, and calls the mock API", async ({
	page,
}) => {
	const suffix = uniqueSuffix();
	await signIn(page, uniqueUsername("signup", suffix), "topbar-signup");

	await createProject(page, `Shop ${suffix}`);
	await openProject(page, `Shop ${suffix}`);
	await createResource(page, "users");
	await createResource(page, "posts");
	await nestUnder(page, "posts", "users");
	await generateAll(page);

	const usersUrl = await mockUrlOf(page, "users");
	const users = await fetchFromPage(page, usersUrl);
	expect(users.status).toBe(200);
	const records = recordsOf(users);
	expect(records.length).toBeGreaterThan(0);
	expect(records.every((record) => typeof record.id === "string")).toBe(true);

	// The nested route answers with the posts of one user, from the same origin.
	const user = await firstWithRecords(
		page,
		records,
		(id) => `${usersUrl}/${id}/posts`,
	);
	expect(user.records.every((post) => post.userId === user.id)).toBe(true);
});
