import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { ProjectModel } from "../projects/project-model.js";
import {
	OWNER,
	createMockProject,
	useMockTestKit,
} from "./testing/mock-test-kit.js";

const kit = useMockTestKit();

describe("per-project mock request counts", () => {
	it("are written on the meter's flush, not per request", async () => {
		const project = await createMockProject();
		const before = await ProjectModel.findById(project.id).lean();
		const started = Date.now();
		const mock = kit.client(project.secret);
		for (let i = 0; i < 3; i += 1) await mock.get("/users");

		const unflushed = await ProjectModel.findById(project.id).lean();
		expect(unflushed?.mockRequests).toBe(0);
		expect(unflushed?.lastRequestAt).toBeNull();

		await kit.meter().flush();
		const flushed = await ProjectModel.findById(project.id).lean();
		expect(flushed?.mockRequests).toBe(3);
		expect(flushed?.lastRequestAt?.getTime()).toBeGreaterThanOrEqual(
			started - 1,
		);
		// Traffic is not an edit of the project.
		expect(flushed?.updatedAt).toEqual(before?.updatedAt);
	});

	it("never re-creates a project deleted before the flush", async () => {
		const project = await createMockProject();
		await kit.client(project.secret).get("/users");
		const deleted = await as(OWNER).send("delete", `/projects/${project.id}`);
		expect(deleted.status).toBe(200);
		await kit.meter().flush();
		expect(await ProjectModel.countDocuments()).toBe(0);
	});
});
