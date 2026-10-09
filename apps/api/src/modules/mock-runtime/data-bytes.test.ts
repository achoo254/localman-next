import { MAX_RESOURCE_BYTES } from "@localman/shared";
import mongoose from "mongoose";
import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { recordBytes } from "../resources/data-size.js";
import { RecordModel } from "../resources/record-model.js";
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

/** Stored `dataBytes` and the sum measured from the records. */
async function bytesOf(resourceId: string) {
	const resource = await ResourceModel.findById(resourceId).lean();
	const records = await RecordModel.find({ resourceId }).lean();
	const measured = records.reduce(
		(sum, record) => sum + recordBytes({ id: record.id, data: record.data }),
		0,
	);
	return { stored: resource?.dataBytes, measured, count: resource?.count };
}

async function usersAndPosts() {
	const project = await createMockProject();
	const users = await createResource(OWNER, project.id, { name: "users" });
	const posts = await createResource(OWNER, project.id, {
		name: "posts",
		parentId: users.id,
		schema: [{ name: "title", type: "String" }],
	});
	await generate(OWNER, project.id, users.id, 4);
	await generate(OWNER, project.id, posts.id, 12);
	return { project, users, posts, mock: kit.client(project.secret) };
}

describe("resource dataBytes", () => {
	it("follows every dashboard and mock write", async () => {
		const { project, users, posts, mock } = await usersAndPosts();
		const expectExact = async (id: string) => {
			const { stored, measured } = await bytesOf(id);
			expect(stored).toBe(measured);
		};
		await expectExact(users.id);
		await expectExact(posts.id);
		await as(OWNER).send(
			"put",
			resourcesPath(project.id, `/${users.id}/data`),
			{
				data: [{ name: "a" }, { name: "b", bio: "x".repeat(500) }],
			},
		);
		await expectExact(users.id);
		await mock.call("post", "/users", { name: "c", tags: ["x", "y"] });
		await mock.call("patch", "/users/1", { name: "longer name ".repeat(20) });
		await mock.call("put", "/users/2", { bio: "short" });
		await expectExact(users.id);
		await mock.call("delete", "/users/1");
		await expectExact(users.id);
		await expectExact(posts.id);
		await as(OWNER).send(
			"post",
			`/projects/${project.id}/resources/generate_all`,
			{
				count: 5,
			},
		);
		await expectExact(users.id);
		await expectExact(posts.id);
		const cloned = await as(OWNER).send(
			"post",
			`/projects/${project.id}/clone`,
			{},
		);
		expect(cloned.status, JSON.stringify(cloned.body)).toBe(201);
		const copies = await ResourceModel.find({
			projectId: cloned.body.id,
		}).lean();
		expect(copies).toHaveLength(2);
		for (const copy of copies) await expectExact(copy._id.toHexString());
		await as(OWNER).send(
			"post",
			`/projects/${project.id}/resources/reset_all`,
			{},
		);
		expect(await bytesOf(users.id)).toMatchObject({ stored: 0, measured: 0 });
	});

	it("measures resources stored before the field existed on their next write", async () => {
		const { users, mock } = await usersAndPosts();
		await ResourceModel.collection.updateMany(
			{},
			{ $unset: { dataBytes: "" } },
		);
		const patched = await mock.call("patch", "/users/2", { note: "hello" });
		expect(patched.status).toBe(200);
		const { stored, measured } = await bytesOf(users.id);
		expect(stored).toBe(measured);
		// A DELETE cascade on unmeasured children leaves them unmeasured.
		await mock.call("delete", "/users/2");
		const posts = await ResourceModel.findOne({ name: "posts" }).lean();
		expect(posts?.dataBytes).toBeUndefined();
	});

	it("checks the resource cap by delta", async () => {
		const project = await createMockProject();
		const items = await createResource(OWNER, project.id, { name: "items" });
		// ~2,095 bytes per record: 999 of them leave a few KB below 2 MB.
		const text = "x".repeat(2_040);
		const put = await as(OWNER).send(
			"put",
			resourcesPath(project.id, `/${items.id}/data`),
			{ data: Array.from({ length: 999 }, () => ({ text })) },
		);
		expect(put.status).toBe(200);
		const { stored } = await bytesOf(items.id);
		expect(stored).toBeLessThan(MAX_RESOURCE_BYTES);
		const mock = kit.client(project.secret);
		const room = MAX_RESOURCE_BYTES - (stored ?? 0);
		expect(room).toBeLessThan(20_000);
		const tooBig = await mock.call("post", "/items", {
			text: "y".repeat(room),
		});
		expect(tooBig.status).toBe(413);
		expect(tooBig.body.error.details).toMatchObject({ limit: "resource" });
		const grows = await mock.call("patch", "/items/1", {
			text: "z".repeat(room + 3_000),
		});
		expect(grows.status).toBe(413);
		const shrinks = await mock.call("patch", "/items/1", { text: "small" });
		expect(shrinks.status).toBe(200);
		expect((await bytesOf(items.id)).stored).toBe(
			(await bytesOf(items.id)).measured,
		);
	});

	it("does not read the other records on PATCH", async () => {
		const { users, mock } = await usersAndPosts();
		const scans: unknown[] = [];
		// The record is read with findOne; any multi-document find is a scan.
		mongoose.set(
			"debug",
			(collection: string, method: string, query: unknown) => {
				if (collection === "records" && method === "find") scans.push(query);
			},
		);
		try {
			const res = await mock.call("patch", "/users/3", { name: "Z" });
			expect(res.status).toBe(200);
		} finally {
			mongoose.set("debug", false);
		}
		expect(scans).toEqual([]);
		expect((await bytesOf(users.id)).stored).toBe(
			(await bytesOf(users.id)).measured,
		);
	});
});
