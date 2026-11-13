import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import {
	BOB,
	OWNER,
	useCollaboratorTestDb,
} from "../collaborators/testing/collaborator-fixture.js";
import { UserModel } from "../users/user-model.js";
import { deleteAccount } from "./account-deletion-service.js";
import {
	releaseDeletionLock,
	takeDeletionLock,
	wasAccountDeleted,
} from "./deleted-account-model.js";
import { FeedbackModel } from "./retired-feature-models.js";
import {
	OWN_ROW_COLLECTIONS,
	countOwnRows,
	seedOwnRows,
} from "./testing/own-rows-fixture.js";

useCollaboratorTestDb();

const zeros = () =>
	Object.fromEntries(OWN_ROW_COLLECTIONS.map((name) => [name, 0]));
const ones = () =>
	Object.fromEntries(OWN_ROW_COLLECTIONS.map((name) => [name, 1]));

describe("deleteAccount", () => {
	it("deletes every own row and the user, and leaves other accounts alone", async () => {
		await seedOwnRows(OWNER);
		await seedOwnRows(BOB);
		await deleteAccount(OWNER);
		expect(await countOwnRows(OWNER)).toEqual(zeros());
		expect(await countOwnRows(BOB)).toEqual(ones());
		expect(await UserModel.exists({ sub: OWNER })).toBeNull();
		expect(await UserModel.exists({ sub: BOB })).toBeTruthy();
		// The account is gone: what its cookie still names is signed out.
		expect((await as(OWNER).get("/users/me")).status).toBe(401);
	});

	it("is idempotent: running it again changes nothing", async () => {
		await seedOwnRows(OWNER);
		await deleteAccount(OWNER);
		await deleteAccount(OWNER);
		expect(await countOwnRows(OWNER)).toEqual(zeros());
		expect(await wasAccountDeleted(OWNER)).toBe(true);
	});

	it("refuses a second deletion of the same account while one runs", async () => {
		expect(await takeDeletionLock(OWNER)).toBe(true);
		await expect(deleteAccount(OWNER)).rejects.toMatchObject({
			status: 409,
			code: "ACCOUNT_DELETION_IN_PROGRESS",
		});
		expect(await UserModel.exists({ sub: OWNER })).toBeTruthy();
		await releaseDeletionLock(OWNER);
		await deleteAccount(OWNER);
		expect(await wasAccountDeleted(OWNER)).toBe(true);
		expect(await wasAccountDeleted(BOB)).toBe(false);
	});

	it("removes its Pro interest submissions from rows it does not own", async () => {
		const theirs = await FeedbackModel.create({
			type: "pro_interest",
			email: "shared@example.test",
			userSub: BOB,
			submissions: [{ userSub: BOB }, { userSub: OWNER }],
		});
		await deleteAccount(OWNER);
		const kept = await FeedbackModel.findById(theirs._id).lean();
		expect(kept?.submissions?.map((entry) => entry.userSub)).toEqual([BOB]);
	});
});
