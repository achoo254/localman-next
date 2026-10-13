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

const FREE = "acc_cleanup_free";
const PRO = "acc_cleanup_pro";
const LAPSED = "acc_cleanup_lapsed";
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
		{ sub: FREE, username: "free" },
		{ sub: PRO, username: "pro", plan: "pro" },
		{ sub: LAPSED, username: "lapsed", plan: "pro", planExpiresAt: new Date() },
	]);
	const idle = await createProject(FREE, "Idle");
	const users = await createResource(FREE, idle, { name: "users" });
	await generate(FREE, idle, users.id, 3);
	const stale = await createProject(FREE, "Stale");
	await lastRequestDaysAgo(stale, DEFAULT_IDLE_DAYS + 30);
	const recent = await createProject(FREE, "Recent");
	await lastRequestDaysAgo(recent, 1);
	const pro = await createProject(PRO, "Pro");
	const lapsed = await createProject(LAPSED, "Lapsed");
	return { idle, stale, recent, pro, lapsed };
}

describe("abandoned project cleanup", () => {
	it("lists Free projects idle past the window without deleting on a dry run", async () => {
		const ids = await seed();
		const logs = captureLogs();
		const summary = await runAbandonedCleanup(
			{ tenantId: "primary", idleDays: DEFAULT_IDLE_DAYS, apply: false },
			logs.logger,
			LATER,
		);
		expect(summary).toEqual({ found: 3, deleted: 0, skipped: 0, failed: 0 });
		const listed = logs.entries("Abandoned project (dry run)");
		expect(listed.map((entry) => entry.projectId).sort()).toEqual(
			[ids.idle, ids.stale, ids.lapsed].sort(),
		);
		expect(listed.find((entry) => entry.projectId === ids.idle)).toMatchObject({
			owner: FREE,
			lastRequestAt: null,
			resources: 1,
		});
		expect(listed.find((entry) => entry.projectId === ids.stale)).toMatchObject(
			{
				lastActivityAt: daysBeforeLater(DEFAULT_IDLE_DAYS + 30).toISOString(),
				lastActivitySource: "mockRequest",
			},
		);
		expect(await ProjectModel.countDocuments()).toBe(5);
		expect(await RecordModel.countDocuments()).toBe(3);
	});

	it("deletes only eligible Free projects, with their data, on --apply", async () => {
		const ids = await seed();
		const logs = captureLogs();
		const summary = await runAbandonedCleanup(
			{ tenantId: "primary", idleDays: DEFAULT_IDLE_DAYS, apply: true },
			logs.logger,
			LATER,
		);
		expect(summary).toEqual({ found: 3, deleted: 3, skipped: 0, failed: 0 });
		expect(logs.entries("Deleted abandoned project")).toHaveLength(3);
		const left = await ProjectModel.find().select("_id").lean();
		expect(left.map((p) => p._id.toHexString()).sort()).toEqual(
			[ids.recent, ids.pro].sort(),
		);
		expect(await ResourceModel.countDocuments()).toBe(0);
		expect(await RecordModel.countDocuments()).toBe(0);
	});
});

describe("abandoned project activity", () => {
	it("counts project and resource edits, not only mock requests", async () => {
		await UserModel.create({ sub: FREE, username: "free" });
		const resourceEdited = await createProject(FREE, "Resource edited");
		const users = await createResource(FREE, resourceEdited, { name: "a" });
		await editedDaysAgo(ResourceModel.collection, users.id, 1);
		const renamed = await createProject(FREE, "Renamed");
		await editedDaysAgo(ProjectModel.collection, renamed, 1);
		const oldEdit = await createProject(FREE, "Old edit");
		const posts = await createResource(FREE, oldEdit, { name: "b" });
		await lastRequestDaysAgo(oldEdit, DEFAULT_IDLE_DAYS + 60);
		await editedDaysAgo(
			ResourceModel.collection,
			posts.id,
			DEFAULT_IDLE_DAYS + 10,
		);
		const logs = captureLogs();
		const summary = await runAbandonedCleanup(
			{ tenantId: "primary", idleDays: DEFAULT_IDLE_DAYS, apply: true },
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
		expect(parseCleanupArgs([])).toEqual({
			tenantId: "primary",
			idleDays: 90,
			apply: false,
		});
		expect(
			parseCleanupArgs([
				"--",
				"--days",
				"30",
				"--apply",
				"--tenant",
				"ten_AAAAAAAAAAAAAAAA",
			]),
		).toEqual({ tenantId: "ten_AAAAAAAAAAAAAAAA", idleDays: 30, apply: true });
	});

	it("rejects bad values and unknown flags", () => {
		for (const argv of [
			["--days", "0"],
			["--days", "1.5"],
			["--force"],
			["--tenant", "hoandat.com"],
		]) {
			expect(() => parseCleanupArgs(argv)).toThrow();
		}
	});
});
