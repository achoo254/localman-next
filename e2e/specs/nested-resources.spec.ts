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
	nodeOf,
} from "../support/resources-ui.js";
import { signIn, uniqueSuffix, uniqueUsername } from "../support/session.js";

test("resources nested with the tree connectors answer on nested routes", async ({
	page,
}) => {
	const suffix = uniqueSuffix();
	await signIn(page, uniqueUsername("nested", suffix));
	await createProject(page, `Tree ${suffix}`);
	await openProject(page, `Tree ${suffix}`);

	await createResource(page, "users");
	await createResource(page, "posts");
	await createResource(page, "comments");
	await nestUnder(page, "posts", "users");
	await nestUnder(page, "comments", "posts");
	await generateAll(page);

	const usersUrl = await mockUrlOf(page, "users");
	const users = recordsOf(await fetchFromPage(page, usersUrl));
	expect(users.length).toBeGreaterThan(0);

	// Posts of one user only: the nested list filters by the parent id.
	const owner = await firstWithRecords(
		page,
		users,
		(id) => `${usersUrl}/${id}/posts`,
	);
	expect(owner.records.every((post) => post.userId === owner.id)).toBe(true);

	// Two levels down: comments of one post of that user.
	const post = await firstWithRecords(
		page,
		owner.records,
		(id) => `${usersUrl}/${owner.id}/posts/${id}/comments`,
	);
	expect(post.records.every((comment) => comment.postId === post.id)).toBe(
		true,
	);

	// The nesting is stored: a reload keeps the tree and the nested route.
	await page.reload();
	await expect(nodeOf(page, "comments")).toBeVisible();
	const after = await fetchFromPage(
		page,
		`${usersUrl}/${owner.id}/posts/${post.id}/comments`,
	);
	expect(after.status).toBe(200);
	expect(recordsOf(after).length).toBe(post.records.length);
});
