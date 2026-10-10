import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import {
	OWNER,
	createMockProject,
	useMockTestKit,
} from "../mock-runtime/testing/mock-test-kit.js";
import {
	createResource,
	resourcesPath,
} from "../resources/testing/resource-fixture.js";
import { CallbackConfigModel } from "./callback-model.js";
import { OutboundJobModel, newJob } from "./outbound-job-model.js";
import { settleTracked } from "./outbound-tracking.js";
import { useOutboundTestKit } from "./testing/outbound-test-kit.js";

const kit = useMockTestKit();
const outbound = useOutboundTestKit();

const onCreate = [
	{ on: "create", target: { kind: "tunnel", port: 3000, path: "/h" } },
];

async function withCallbacks(projectId: string, resourceId: string) {
	const path = `/projects/${projectId}/resources/${resourceId}/callbacks`;
	const set = await as(OWNER).send("put", path, { callbacks: onCreate });
	expect(set.status, JSON.stringify(set.body)).toBe(200);
}

const oid = (id: string) => new Types.ObjectId(id);

describe("deleting a resource", () => {
	it("removes its callbacks and waiting deliveries, descendants' too", async () => {
		const project = await createMockProject();
		const users = await createResource(OWNER, project.id, { name: "users" });
		const posts = await createResource(OWNER, project.id, {
			name: "posts",
			parentId: users.id,
		});
		const tags = await createResource(OWNER, project.id, { name: "tags" });
		for (const resource of [users, posts, tags]) {
			await withCallbacks(project.id, resource.id);
		}
		const mock = kit.client(project.secret);
		const user = await mock.call("post", "/users", { name: "Ada" });
		await mock.call("post", `/users/${user.body.id}/posts`, { title: "Hi" });
		await mock.call("post", "/tags", { label: "x" });
		await settleTracked();
		expect(await OutboundJobModel.countDocuments()).toBe(3);

		const del = await as(OWNER).send(
			"delete",
			resourcesPath(project.id, `/${users.id}`),
		);
		expect(del.status, JSON.stringify(del.body)).toBe(200);
		expect(del.body.removed).toHaveLength(2);

		const left = await CallbackConfigModel.find().lean();
		expect(left.map((config) => config.resourceId.toHexString())).toEqual([
			tags.id,
		]);
		const jobs = await OutboundJobModel.find().lean();
		expect(jobs.map((job) => job.resourceId?.toHexString())).toEqual([tags.id]);
	});

	it("drops a delivery queued after its callbacks were deleted", async () => {
		outbound.answer("/h", 200);
		const project = await createMockProject();
		const message = {
			target: { kind: "tunnel" as const, port: 3000, path: "/h" },
			query: "",
			method: "POST",
			headers: [],
			body: Buffer.from("{}"),
		};
		const ref = {
			kind: "callback" as const,
			projectId: oid(project.id),
			owner: OWNER,
			resourceId: new Types.ObjectId(),
			callbackId: "gone",
			event: "create" as const,
		};
		await OutboundJobModel.insertMany([newJob(ref, message, new Date())]);
		await outbound.queue().drain();
		expect(outbound.received).toHaveLength(0);
		expect(await OutboundJobModel.countDocuments()).toBe(0);
	});
});
