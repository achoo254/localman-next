import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { useDashboardTestDb } from "../../test-support/dashboard-test-app.js";
import { captureLogs } from "../../test-support/log-capture.js";
import { RecordModel } from "../resources/record-model.js";
import { ResourceModel } from "../resources/resource-model.js";
import {
	createProject,
	createResource,
	generate,
} from "../resources/testing/resource-fixture.js";
import { UserModel } from "../users/user-model.js";
import {
	DEFAULT_IDLE_DAYS,
	parseCleanupArgs,
	runAbandonedCleanup,
} from "./abandoned-projects.js";
import { ProjectModel } from "./project-model.js";

const OWNER = "acc_cleanup_owner";
const OTHER = "acc_cleanup_other";
const DAY_MS = 24 * 60 * 60 * 1000;
/** Projects created now are 200 days old at this instant. */
const LATER = new Date(Date.now() + 200 * DAY_MS);

useDashboardTestDb();

const daysBeforeLater = (days: number) =>
	new Date(LATER.getTime() - days * DAY_MS);

async function lastRequestDaysAgo(projectId: string, days: number) {
	await ProjectModel.updateOne(
		{ _id: projectId },
		{ $set: { lastRequestAt: daysBeforeLater(days) } },
	);
}

/** Moves `updatedAt` through the driver: mongoose would stamp the real now. */
async function editedDaysAgo(
	collection: typeof ProjectModel.collection,
	id: string,
	days: number,
) {
	await collection.updateOne(
		{ _id: new Types.ObjectId(id) },
		{ $set: { updatedAt: daysBeforeLater(days) } },
	);
}

async function seed() {
	await UserModel.create([
		{ sub: OWNER, username: "owner" },
		{ sub: OTHER, username: "other" },
	]);
	const idle = await createProject(OWNER, "Idle");
	const users = await createResource(OWNER, idle, { name: "users" });
	await generate(OWNER, idle, users.id, 3);
	const stale = await createProject(OWNER, "Stale");
	await lastRequestDaysAgo(stale, DEFAULT_IDLE_DAYS + 30);
	const recent = await createProject(OWNER, "Recent");
	await lastRequestDaysAgo(recent, 1);
	const other = await createProject(OTHER, "Other owner");
	return { idle, stale, recent, other };
}

describe("abandoned project cleanup", () => {
	it("lists projects of every owner idle past the window without deleting on a dry run", async () => {
		const ids = await seed();
		const logs = captureLogs();
		const summary = await runAbandonedCleanup(
			{ idleDays: DEFAULT_IDLE_DAYS, apply: false },
			logs.logger,
			LATER,
		);
		expect(summary).toEqual({ found: 3, deleted: 0, skipped: 0, failed: 0 });
		const listed = logs.entries("Abandoned project (dry run)");
		expect(listed.map((entry) => entry.projectId).sort()).toEqual(
			[ids.idle, ids.stale, ids.other].sort(),
		);
		expect(listed.find((entry) => entry.projectId === ids.idle)).toMatchObject({
			owner: OWNER,
			lastRequestAt: null,
			resources: 1,
		});
		expect(listed.find((entry) => entry.projectId === ids.stale)).toMatchObject(
			{
				lastActivityAt: daysBeforeLater(DEFAULT_IDLE_DAYS + 30).toISOString(),
				lastActivitySource: "mockRequest",
			},
		);
		expect(await ProjectModel.countDocuments()).toBe(4);
		expect(await RecordModel.countDocuments()).toBe(3);
	});

	it("deletes only idle projects, with their data, on --apply", async () => {
		const ids = await seed();
		const logs = captureLogs();
		const summary = await runAbandonedCleanup(
			{ idleDays: DEFAULT_IDLE_DAYS, apply: true },
			logs.logger,
			LATER,
		);
		expect(summary).toEqual({ found: 3, deleted: 3, skipped: 0, failed: 0 });
		expect(logs.entries("Deleted abandoned project")).toHaveLength(3);
		const left = await ProjectModel.find().select("_id").lean();
		expect(left.map((p) => p._id.toHexString()).sort()).toEqual([ids.recent]);
		expect(await ResourceModel.countDocuments()).toBe(0);
		expect(await RecordModel.countDocuments()).toBe(0);
	});
});

describe("abandoned project activity", () => {
	it("counts project and resource edits, not only mock requests", async () => {
		await UserModel.create({ sub: OWNER, username: "owner" });
		const resourceEdited = await createProject(OWNER, "Resource edited");
		const users = await createResource(OWNER, resourceEdited, { name: "a" });
		await editedDaysAgo(ResourceModel.collection, users.id, 1);
		const renamed = await createProject(OWNER, "Renamed");
		await editedDaysAgo(ProjectModel.collection, renamed, 1);
		const oldEdit = await createProject(OWNER, "Old edit");
		const posts = await createResource(OWNER, oldEdit, { name: "b" });
		await lastRequestDaysAgo(oldEdit, DEFAULT_IDLE_DAYS + 60);
		await editedDaysAgo(
			ResourceModel.collection,
			posts.id,
			DEFAULT_IDLE_DAYS + 10,
		);
		const logs = captureLogs();
		const summary = await runAbandonedCleanup(
			{ idleDays: DEFAULT_IDLE_DAYS, apply: true },
			logs.logger,
			LATER,
		);
		expect(summary).toEqual({ found: 1, deleted: 1, skipped: 0, failed: 0 });
		expect(logs.entries("Deleted abandoned project")).toMatchObject([
			{
				projectId: oldEdit,
				lastActivityAt: daysBeforeLater(DEFAULT_IDLE_DAYS + 10).toISOString(),
				lastActivitySource: "resourceEdit",
			},
		]);
		const left = await ProjectModel.find().select("_id").lean();
		expect(left.map((p) => p._id.toHexString()).sort()).toEqual(
			[resourceEdited, renamed].sort(),
		);
	});
});

describe("parseCleanupArgs", () => {
	it("defaults to a 90-day dry run and reads --days and --apply", () => {
		expect(parseCleanupArgs([])).toEqual({ idleDays: 90, apply: false });
		expect(parseCleanupArgs(["--", "--days", "30", "--apply"])).toEqual({
			idleDays: 30,
			apply: true,
		});
	});

	it("rejects bad values and unknown flags", () => {
		for (const argv of [
			["--days", "0"],
			["--days", "1.5"],
			["--force"],
			["--tenant", "primary"],
		]) {
			expect(() => parseCleanupArgs(argv)).toThrow();
		}
	});
});
