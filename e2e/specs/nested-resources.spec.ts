import { type Page, expect, test } from "@playwright/test";
import {
	type ParentWithRecords,
	fetchFromPage,
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

	// Two levels down: comments of one post of one user. The generator
	// spreads children at random, so the first user with posts may have no
	// post with comments; look through every user that has posts.
	const { owner, post } = await firstPostWithComments(page, usersUrl, users);
	// Posts of one user only: the nested list filters by the parent id.
	expect(owner.records.every((item) => item.userId === owner.id)).toBe(true);
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

async function firstPostWithComments(
	page: Page,
	usersUrl: string,
	users: readonly Record<string, unknown>[],
): Promise<{ owner: ParentWithRecords; post: ParentWithRecords }> {
	for (const user of users) {
		const ownerId = String(user.id);
		const posts = recordsOf(
			await fetchFromPage(page, `${usersUrl}/${ownerId}/posts`),
		);
		if (posts.length === 0) continue;
		const owner = { id: ownerId, records: posts };
		for (const item of posts) {
			const postId = String(item.id);
			const comments = recordsOf(
				await fetchFromPage(
					page,
					`${usersUrl}/${ownerId}/posts/${postId}/comments`,
				),
			);
			if (comments.length > 0) {
				return { owner, post: { id: postId, records: comments } };
			}
		}
	}
	throw new Error("No post of any user has comments on its nested route");
}
