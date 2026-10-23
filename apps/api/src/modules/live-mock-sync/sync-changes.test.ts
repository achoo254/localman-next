import { completeEndpoints } from "@localman/shared";
import type { MergePreview } from "@localman/shared/api-client";
import { describe, expect, it } from "vitest";
import { createLogger } from "../../logger.js";
import { as } from "../../test-support/dashboard-test-app.js";
import { patchAs } from "../access/testing/access-fixture.js";
import { emitResourceChanged } from "../resources/resource-events.js";
import {
	createResource,
	resourcesPath,
} from "../resources/testing/resource-fixture.js";
import { LiveMockSyncJob } from "./sync-job.js";
import { SyncLinkModel } from "./sync-link-model.js";
import {
	EVE,
	collectionOf,
	environmentOf,
	renameResource,
	requestNamed,
	syncNow,
	syncedUsers,
	useSyncTestDb,
} from "./testing/sync-fixture.js";

useSyncTestDb();

const newestChange = async (collection: string) => {
	const res = await as(EVE).get(`/collections/${collection}/changelog`);
	expect(res.status).toBe(200);
	const session = res.body.sessions[0];
	return { authorName: session.authorName, change: session.changes[0] };
};

describe("following the mock", () => {
	it("adds the requests of a new resource, by Live Mock Sync", async () => {
		const s = await syncedUsers();
		await createResource(EVE, s.project, { name: "posts", parentId: s.users });
		await syncNow(s.project);
		const detail = await collectionOf(EVE, s.collection);
		expect(requestNamed(detail, "List posts").draft.url).toBe(
			"{{baseUrl}}/users/{{userId}}/posts",
		);
		const { authorName, change } = await newestChange(s.collection);
		expect(authorName).toBe("Live Mock Sync");
		expect(change).toMatchObject({ action: "sync", entityName: "Shop" });
		const environment = await environmentOf(EVE, s.environment);
		expect(environment.variables.map((v) => v.key)).toContain("postId");
	});

	it("renames in place: the same node, the new path", async () => {
		const s = await syncedUsers();
		const before = requestNamed(
			await collectionOf(EVE, s.collection),
			"List users",
		);
		expect((await renameResource(s, "members")).status).toBe(200);
		await syncNow(s.project);
		const after = requestNamed(
			await collectionOf(EVE, s.collection),
			"List members",
		);
		expect(after.id).toBe(before.id);
		expect(after.draft.url).toBe("{{baseUrl}}/members");
	});

	it("moves the requests of a disabled endpoint and a deleted resource to _removed", async () => {
		const s = await syncedUsers();
		const posts = await createResource(EVE, s.project, { name: "posts" });
		await syncNow(s.project);
		await as(EVE).send("put", resourcesPath(s.project, `/${s.users}`), {
			name: "users",
			schema: [{ name: "name", type: "String" }],
			endpoints: completeEndpoints([
				{ method: "DELETE", path: "/:res/:id", enabled: false },
			]),
		});
		const gone = await as(EVE).send(
			"delete",
			resourcesPath(s.project, `/${posts.id}`),
		);
		expect(gone.status, JSON.stringify(gone.body)).toBe(200);
		await syncNow(s.project);
		const detail = await collectionOf(EVE, s.collection);
		const removed = detail.nodes.find((n) => n.name === "_removed");
		expect(removed?.kind).toBe("folder");
		expect(requestNamed(detail, "Delete from users").parentId).toBe(
			removed?.id,
		);
		const postsFolder = detail.nodes.find((n) => n.name === "posts");
		expect(postsFolder?.parentId).toBe(removed?.id);
		// Its requests stay inside it.
		expect(requestNamed(detail, "List posts").parentId).toBe(postsFolder?.id);
	});

	it("keeps the user's header while the mock changes the path", async () => {
		const s = await syncedUsers();
		const list = requestNamed(
			await collectionOf(EVE, s.collection),
			"List users",
		);
		const header = { id: "h1", key: "X-Trace", value: "1", enabled: true };
		const edit = await patchAs(
			EVE,
			`/collections/${s.collection}/nodes/${list.id}`,
			{
				draft: { ...list.draft, headers: [header] },
			},
		);
		expect(edit.status, JSON.stringify(edit.body)).toBe(200);
		await renameResource(s, "members");
		await syncNow(s.project);
		const after = requestNamed(
			await collectionOf(EVE, s.collection),
			"List members",
		);
		expect(after.draft.url).toBe("{{baseUrl}}/members");
		expect(after.draft.headers).toEqual([header]);
	});

	it("holds a clash for a choice, then keeps the user's value", async () => {
		const s = await syncedUsers();
		const list = requestNamed(
			await collectionOf(EVE, s.collection),
			"List users",
		);
		await patchAs(EVE, `/collections/${s.collection}/nodes/${list.id}`, {
			draft: { ...list.draft, url: "{{baseUrl}}/people" },
		});
		await renameResource(s, "members");
		await syncNow(s.project);
		const status = await as(EVE).get(`/collections/${s.collection}/mock-sync`);
		expect(status.body.conflicts).toBeGreaterThan(0);
		const preview = (
			await as(EVE).get(`/collections/${s.collection}/mock-sync/preview`)
		).body as MergePreview;
		const urlConflict = preview.conflicts.find((c) => c.path === "draft.url");
		expect(urlConflict).toBeDefined();
		const partial = await as(EVE).send(
			"post",
			`/collections/${s.collection}/mock-sync/resolve`,
			{ resolutions: {} },
		);
		expect(partial.status).toBe(409);
		const resolutions = Object.fromEntries(
			preview.conflicts.map((c) => [c.id, "destination"]),
		);
		const done = await as(EVE).send(
			"post",
			`/collections/${s.collection}/mock-sync/resolve`,
			{ resolutions },
		);
		expect(done.status, JSON.stringify(done.body)).toBe(200);
		expect(done.body.conflicts).toBe(0);
		const after = await collectionOf(EVE, s.collection);
		expect(after.nodes.find((n) => n.id === list.id)).toMatchObject({
			draft: { url: "{{baseUrl}}/people" },
		});
		// Settled: the next sync brings nothing back.
		await syncNow(s.project);
		expect(
			(await as(EVE).get(`/collections/${s.collection}/mock-sync`)).body
				.conflicts,
		).toBe(0);
	});

	it("moves baseUrl with the project's prefix", async () => {
		const s = await syncedUsers();
		const res = await as(EVE).send("put", `/projects/${s.project}`, {
			name: "Shop",
			prefix: "/v2",
		});
		expect(res.status, JSON.stringify(res.body)).toBe(200);
		await syncNow(s.project);
		const environment = await environmentOf(EVE, s.environment);
		const baseUrl = environment.variables.find((v) => v.key === "baseUrl");
		expect(baseUrl?.sharedValue).toMatch(/\/v2$/);
	});
});

describe("LiveMockSyncJob", () => {
	it("makes one sync of a burst of changes", async () => {
		const s = await syncedUsers();
		const job = new LiveMockSyncJob(createLogger("silent"), 60_000);
		job.start();
		await renameResource(s, "members");
		emitResourceChanged(s.project);
		await job.stop();
		const link = await SyncLinkModel.findOne({}).lean();
		expect(link?.syncCount).toBe(1);
		const detail = await collectionOf(EVE, s.collection);
		expect(requestNamed(detail, "List members")).toBeDefined();
	});
});
