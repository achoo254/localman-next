import { describe, expect, it } from "vitest";
import {
	as,
	guest,
	useDashboardTestDb,
} from "../../test-support/dashboard-test-app.js";
import { ContactMessageModel } from "./contact-message-model.js";
import { FeedbackModel } from "./feedback-model.js";

const OWNER = "acc_owner";
const LIST = "/admin/contact-messages";
const statusPath = (id: string) => `${LIST}/${id}/status`;

useDashboardTestDb(() => ({ ownerSubs: new Set([OWNER]) }));

async function seed(): Promise<string[]> {
	const now = Date.now();
	const docs = await ContactMessageModel.insertMany(
		[
			{ category: "bug", status: "new", ageMin: 3 },
			{ category: "feedback", status: "read", ageMin: 2 },
			{ category: "plan_question", status: "new", ageMin: 1 },
		].map((seedDoc, i) => ({
			type: "contact",
			category: seedDoc.category,
			status: seedDoc.status,
			message: `Tin ${i}`,
			source: "landing",
			createdAt: new Date(now - seedDoc.ageMin * 60_000),
			updatedAt: new Date(now - seedDoc.ageMin * 60_000),
		})),
		{ timestamps: false },
	);
	// A Pro interest entry in the same collection must never show up.
	await FeedbackModel.create({
		type: "pro_interest",
		email: "a@x.com",
		name: "A",
		needs: ["mock"],
		teamSize: "1",
		source: "landing",
		consentAt: new Date(),
	});
	return docs.map((doc) => doc._id.toHexString());
}

describe("contact inbox admin operations", () => {
	it("refuses anyone but the owner", async () => {
		const [id = ""] = await seed();
		expect((await guest().get(LIST)).status).toBe(401);
		const list = await as("acc_user").get(LIST);
		expect(list.status).toBe(403);
		expect(list.body.error.code).toBe("FORBIDDEN");
		const update = await as("acc_user").send("put", statusPath(id), {
			status: "read",
		});
		expect(update.status).toBe(403);
		expect((await ContactMessageModel.findById(id).lean())?.status).toBe("new");
	});

	it("lists newest first, paged, filtered by status and category", async () => {
		await seed();
		const all = await as(OWNER).get(`${LIST}?pageSize=2`);
		expect(all.status).toBe(200);
		expect(all.body.total).toBe(3);
		expect(all.body.items.map((i: { message: string }) => i.message)).toEqual([
			"Tin 2",
			"Tin 1",
		]);
		expect(all.body.items[0]).toMatchObject({
			category: "plan_question",
			contact: null,
			name: null,
			userSub: null,
			readAt: null,
		});
		const page2 = await as(OWNER).get(`${LIST}?pageSize=2&page=2`);
		expect(page2.body.items).toHaveLength(1);

		const unread = await as(OWNER).get(`${LIST}?status=new`);
		expect(unread.body.total).toBe(2);
		const bugs = await as(OWNER).get(`${LIST}?status=new&category=bug`);
		expect(bugs.body.items.map((i: { message: string }) => i.message)).toEqual([
			"Tin 0",
		]);
		for (const query of ["status=archived", "page=10001"]) {
			expect((await as(OWNER).get(`${LIST}?${query}`)).status).toBe(400);
		}
	});

	it("marks a message read, then resolved, and back to new", async () => {
		const [id = ""] = await seed();
		const read = await as(OWNER).send("put", statusPath(id), {
			status: "read",
		});
		expect(read.status).toBe(200);
		expect(read.body.status).toBe("read");
		const readAt: string = read.body.readAt;
		expect(readAt).toEqual(expect.any(String));

		const resolved = await as(OWNER).send("put", statusPath(id), {
			status: "resolved",
		});
		expect(resolved.body).toMatchObject({ status: "resolved", readAt });
		expect(resolved.body.resolvedAt).toEqual(expect.any(String));

		const reopened = await as(OWNER).send("put", statusPath(id), {
			status: "new",
		});
		expect(reopened.body).toMatchObject({
			status: "new",
			readAt: null,
			resolvedAt: null,
		});
	});

	it("answers 404 for unknown ids and Pro interest entries", async () => {
		await seed();
		const pro = await FeedbackModel.findOne({ type: "pro_interest" }).lean();
		const ids = ["nope", "0123456789abcdef01234567", String(pro?._id)];
		for (const id of ids) {
			const res = await as(OWNER).send("put", statusPath(id), {
				status: "read",
			});
			expect(res.status).toBe(404);
		}
	});

	it("deletes a message for the owner only, dry run first", async () => {
		const [id = ""] = await seed();
		const path = `${LIST}/${id}`;
		const refused = await as("acc_user").send("delete", path);
		expect(refused.status).toBe(403);
		const preview = await as(OWNER).send("delete", `${path}?dryRun=true`);
		expect(preview.body).toEqual({ id, deleted: false, dryRun: true });
		expect(await ContactMessageModel.countDocuments({ _id: id })).toBe(1);
		const done = await as(OWNER).send("delete", path);
		expect(done.body).toEqual({ id, deleted: true, dryRun: false });
		expect(await ContactMessageModel.countDocuments({ _id: id })).toBe(0);
		expect((await as(OWNER).send("delete", path)).status).toBe(404);
		const pro = await FeedbackModel.findOne({ type: "pro_interest" }).lean();
		const proPath = `${LIST}/${String(pro?._id)}`;
		expect((await as(OWNER).send("delete", proPath)).status).toBe(404);
		expect(await FeedbackModel.countDocuments({ type: "pro_interest" })).toBe(
			1,
		);
	});
});
