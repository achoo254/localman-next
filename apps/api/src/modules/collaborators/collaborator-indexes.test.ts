import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { useDashboardTestDb } from "../../test-support/dashboard-test-app.js";
import { CASE_INSENSITIVE_COLLATION, UserModel } from "../users/user-model.js";
import {
	CollaboratorModel,
	acceptedCountsPipeline,
	seatHoldersFilter,
} from "./collaborator-model.js";
import { MagicLinkModel } from "./magic-link-model.js";

useDashboardTestDb();

/** The plan uses an index and never scans the whole collection. */
function expectIndexScan(explained: unknown): void {
	const plan = JSON.stringify(explained);
	expect(plan).toContain("IXSCAN");
	expect(plan).not.toContain("COLLSCAN");
}

describe("indexes of the hot collaborator queries", () => {
	it("serves token lookups by index", async () => {
		await CollaboratorModel.create({
			projectId: new Types.ObjectId(),
			status: "pending",
			invitedBy: "acc_owner",
			inviteeEmail: "a@example.com",
			inviteTokenHash: "f".repeat(64),
			expiresAt: new Date(Date.now() + 60_000),
		});
		expectIndexScan(
			await CollaboratorModel.findOne({
				inviteTokenHash: "f".repeat(64),
			}).explain(),
		);
		expectIndexScan(
			await MagicLinkModel.findOne({ tokenHash: "f".repeat(64) }).explain(),
		);
	});

	it("serves member counts of project views and seats by index", async () => {
		const projectId = new Types.ObjectId();
		expectIndexScan(
			await CollaboratorModel.aggregate(
				acceptedCountsPipeline([projectId, new Types.ObjectId()]),
			).explain(),
		);
		expectIndexScan(
			await CollaboratorModel.find(
				seatHoldersFilter(projectId, new Date()),
			).explain(),
		);
	});

	it("serves case-insensitive username and email lookups by index", async () => {
		expectIndexScan(
			await UserModel.findOne({ username: "Bob" })
				.collation(CASE_INSENSITIVE_COLLATION)
				.explain(),
		);
		expectIndexScan(
			await UserModel.findOne({ email: "Bob@Example.com", emailVerified: true })
				.collation(CASE_INSENSITIVE_COLLATION)
				.explain(),
		);
	});
});
