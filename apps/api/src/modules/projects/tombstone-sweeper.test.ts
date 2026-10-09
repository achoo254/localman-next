import { beforeEach, describe, expect, it } from "vitest";
import {
	as,
	useDashboardTestDb,
} from "../../test-support/dashboard-test-app.js";
import { captureLogs } from "../../test-support/log-capture.js";
import { RecordModel } from "../resources/record-model.js";
import { ResourceModel } from "../resources/resource-model.js";
import {
	createProject,
	createResource,
	generate,
} from "../resources/testing/resource-fixture.js";
import { UserModel } from "../users/user-model.js";
import { ProjectModel } from "./project-model.js";
import {
	TOMBSTONE_GRACE_MS,
	TombstoneSweeper,
	sweepTombstones,
} from "./tombstone-sweeper.js";

const OWNER = "acc_sweeper_owner";

useDashboardTestDb();
beforeEach(async () => {
	await UserModel.create({ sub: OWNER, username: "sweeper" });
});

/** A project whose deletion stopped after the tombstone, `ageMs` ago. */
async function interruptedDeletion(ageMs: number): Promise<string> {
	const project = await createProject(OWNER);
	const users = await createResource(OWNER, project, { name: "users" });
	await generate(OWNER, project, users.id, 2);
	await ProjectModel.updateOne(
		{ _id: project },
		{ $set: { deletingAt: new Date(Date.now() - ageMs) } },
	);
	return project;
}

describe("tombstone sweeper", () => {
	it("finishes deletions older than the grace period and leaves the rest", async () => {
		const stale = await interruptedDeletion(TOMBSTONE_GRACE_MS + 60_000);
		const fresh = await interruptedDeletion(60_000);
		const live = await createProject(OWNER, "Live");
		const logs = captureLogs();

		expect(await sweepTombstones(logs.logger)).toBe(1);
		expect(await ProjectModel.exists({ _id: stale })).toBeNull();
		expect(await ResourceModel.countDocuments({ projectId: stale })).toBe(0);
		expect(await RecordModel.countDocuments({ projectId: stale })).toBe(0);
		expect(await ProjectModel.exists({ _id: fresh })).not.toBeNull();
		expect(await ResourceModel.countDocuments({ projectId: fresh })).toBe(1);
		expect(await ProjectModel.exists({ _id: live })).not.toBeNull();
		expect(
			logs.entries("Finished an interrupted project deletion"),
		).toMatchObject([{ projectId: stale }]);
		// Idempotent: nothing left to do.
		expect(await sweepTombstones(logs.logger)).toBe(0);
	});

	it("is safe alongside a DELETE resuming the same project", async () => {
		const stale = await interruptedDeletion(TOMBSTONE_GRACE_MS + 60_000);
		const logs = captureLogs();
		const [swept, deleted] = await Promise.all([
			sweepTombstones(logs.logger),
			as(OWNER).send("delete", `/projects/${stale}`),
		]);
		expect([0, 1]).toContain(swept);
		expect([200, 404]).toContain(deleted.status);
		expect(logs.entries("Tombstone sweep failed")).toEqual([]);
		expect(await ProjectModel.countDocuments()).toBe(0);
		expect(await ResourceModel.countDocuments()).toBe(0);
		expect(await RecordModel.countDocuments()).toBe(0);
	});

	it("sweeps at start, and stop waits for the running sweep", async () => {
		const stale = await interruptedDeletion(TOMBSTONE_GRACE_MS + 60_000);
		const sweeper = new TombstoneSweeper(captureLogs().logger, 60_000);
		sweeper.start();
		await sweeper.stop();
		expect(await ProjectModel.exists({ _id: stale })).toBeNull();
	});
});
