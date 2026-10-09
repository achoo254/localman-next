import { describe, expect, it } from "vitest";
import { useDashboardTestDb } from "../../test-support/dashboard-test-app.js";
import { createProject } from "../resources/testing/resource-fixture.js";
import { ProjectModel } from "./project-model.js";

useDashboardTestDb();

/** The plan uses an index and never scans the whole collection. */
function expectIndexScan(explained: unknown): void {
	const plan = JSON.stringify(explained);
	expect(plan).toContain("IXSCAN");
	expect(plan).not.toContain("COLLSCAN");
}

describe("indexes of the project sweeps", () => {
	it("serves the tombstone sweep from an index that skips live projects", async () => {
		const live = await createProject("acc_index_owner", "Live");
		const tombstoned = await createProject("acc_index_owner", "Gone");
		await ProjectModel.updateOne(
			{ _id: tombstoned },
			{ $set: { deletingAt: new Date(0) } },
		);
		expectIndexScan(
			await ProjectModel.find({ deletingAt: { $lt: new Date() } })
				.sort({ deletingAt: 1 })
				.limit(100)
				.explain(),
		);
		const stored = await ProjectModel.findById(live).lean();
		expect(stored).not.toHaveProperty("deletingAt");
	});
});
