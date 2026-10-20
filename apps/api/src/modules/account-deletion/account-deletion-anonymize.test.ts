import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { ADA, EVE, teamWorkspace } from "../access/testing/access-fixture.js";
import { CollectionModel } from "../collections/collection-model.js";
import { CollectionNodeModel } from "../collections/collection-node-model.js";
import { CollectionRevisionModel } from "../collections/collection-revision-model.js";
import {
	addNode,
	createAs,
	requestNode,
	useCollectionTestDb,
} from "../collections/testing/collection-fixture.js";
import { CommentModel } from "../comments/comment-model.js";
import { PullRequestModel } from "../version-control/pull-request-model.js";
import { DELETED_USER } from "./account-references.js";

useCollectionTestDb();

describe("account deletion in team content it leaves", () => {
	it("keeps the content and replaces the account's name, without touching updatedAt", async () => {
		const ws = (
			await teamWorkspace({ [ADA]: "admin", [EVE]: "admin" })
		).toHexString();
		const created = await createAs(ADA, ws, { name: "Team API" });
		const node = await addNode(ADA, created.id, requestNode("List"));
		const threadId = new Types.ObjectId();
		await CommentModel.create({
			_id: threadId,
			collectionId: created.id,
			threadId,
			authorId: ADA,
			body: "Looks good @eve",
			mentions: [ADA, EVE],
			resolvedBy: ADA,
		});
		const pr = await PullRequestModel.create({
			sourceId: created.id,
			forkId: new Types.ObjectId(),
			title: "Add list",
			authorId: EVE,
			reviewers: [{ userId: ADA }, { userId: EVE }],
			notified: [ADA],
			mergedBy: ADA,
		});
		const before = await CollectionModel.findById(created.id).lean();

		const res = await as(ADA).send("delete", "/users/me", { confirm: "ada" });
		expect(res.status, JSON.stringify(res.body)).toBe(200);

		const after = await CollectionModel.findById(created.id).lean();
		expect(after).toMatchObject({
			name: "Team API",
			createdBy: DELETED_USER,
			updatedBy: DELETED_USER,
		});
		expect(after?.updatedAt).toEqual(before?.updatedAt);
		expect(
			(await CollectionNodeModel.findById(node.id).lean())?.updatedBy,
		).toBe(DELETED_USER);
		expect(
			await CollectionRevisionModel.countDocuments({ authorId: ADA }),
		).toBe(0);
		expect(
			await CollectionRevisionModel.countDocuments({ authorId: DELETED_USER }),
		).toBeGreaterThan(0);
		expect(await CommentModel.findById(threadId).lean()).toMatchObject({
			body: "Looks good @eve",
			authorId: DELETED_USER,
			resolvedBy: DELETED_USER,
			mentions: [EVE],
		});
		expect(await PullRequestModel.findById(pr._id).lean()).toMatchObject({
			authorId: EVE,
			mergedBy: DELETED_USER,
			notified: [],
			reviewers: [
				expect.objectContaining({ userId: DELETED_USER }),
				expect.objectContaining({ userId: EVE }),
			],
		});
	});

	it("keeps one anonymous reviewer when another deleted reviewer is there", async () => {
		const pr = await PullRequestModel.create({
			sourceId: new Types.ObjectId(),
			forkId: new Types.ObjectId(),
			title: "Two deleted reviewers",
			authorId: EVE,
			reviewers: [
				{ userId: DELETED_USER, decision: "approved" },
				{ userId: ADA, decision: "approved" },
				{ userId: EVE },
			],
		});
		const res = await as(ADA).send("delete", "/users/me", { confirm: "ada" });
		expect(res.status, JSON.stringify(res.body)).toBe(200);
		const after = await PullRequestModel.findById(pr._id).lean();
		expect(after?.reviewers.map((entry) => entry.userId)).toEqual([
			DELETED_USER,
			EVE,
		]);
	});
});
