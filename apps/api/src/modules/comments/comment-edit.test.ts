import { describe, expect, it } from "vitest";
import { ADA, EVE, VIC, patchAs } from "../access/testing/access-fixture.js";
import { useCollectionTestDb } from "../collections/testing/collection-fixture.js";
import { comment, setup, threadsOf } from "./testing/comment-fixture.js";

useCollectionTestDb();

describe("editing a comment", () => {
	it("lets its author change the body, and marks it edited", async () => {
		const { id, nodeId } = await setup();
		const first = await comment(EVE, id, { nodeId, body: "Old text" });
		expect(first.status).toBe(201);
		const [before] = await threadsOf(EVE, id, `?nodeId=${nodeId}`);
		expect(before?.comments[0]?.editedAt).toBeNull();

		const res = await patchAs(
			EVE,
			`/collections/${id}/comments/${first.body.id}`,
			{ body: "New **text**" },
		);
		expect(res.status, JSON.stringify(res.body)).toBe(200);

		const [after] = await threadsOf(VIC, id, `?nodeId=${nodeId}`);
		const edited = after?.comments[0];
		expect(edited?.body).toBe("New **text**");
		expect(edited?.editedAt).not.toBeNull();
		expect(edited?.canEdit).toBe(false);
	});

	it("lets the author edit a reply, and keeps the thread's order", async () => {
		const { id, nodeId } = await setup();
		const first = await comment(EVE, id, { nodeId, body: "Plan" });
		const reply = await comment(VIC, id, {
			threadId: first.body.threadId,
			body: "Ok",
		});
		expect(reply.status).toBe(201);

		const res = await patchAs(
			VIC,
			`/collections/${id}/comments/${reply.body.id}`,
			{ body: "Ok, with changes" },
		);
		expect(res.status, JSON.stringify(res.body)).toBe(200);

		const [thread] = await threadsOf(VIC, id, `?nodeId=${nodeId}`);
		expect(thread?.comments.map((item) => item.body)).toEqual([
			"Plan",
			"Ok, with changes",
		]);
		expect(thread?.comments[0]?.editedAt).toBeNull();
		expect(thread?.comments[1]?.editedAt).not.toBeNull();
	});

	it("still refuses an edit by someone else, Admins included", async () => {
		const { id, nodeId } = await setup();
		const first = await comment(EVE, id, { nodeId, body: "Mine" });
		const res = await patchAs(
			ADA,
			`/collections/${id}/comments/${first.body.id}`,
			{ body: "Changed by Ada" },
		);
		expect(res.status).toBe(403);
		const [thread] = await threadsOf(EVE, id, `?nodeId=${nodeId}`);
		expect(thread?.comments[0]?.body).toBe("Mine");
		expect(thread?.comments[0]?.editedAt).toBeNull();
	});
});
