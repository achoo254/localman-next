import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { EVE, OLLIE, VIC } from "../access/testing/access-fixture.js";
import {
	createAs,
	teamOfThree,
	useCollectionTestDb,
} from "../collections/testing/collection-fixture.js";
import { comment, setup, threadsOf } from "./testing/comment-fixture.js";

useCollectionTestDb();

describe("comment counts, reactions and limits", () => {
	it("counts open threads per item and toggles reactions once per person", async () => {
		const { id, nodeId } = await setup();
		const { body } = await comment(VIC, id, { nodeId, body: "a" });
		await comment(VIC, id, { body: "b" });
		const counts = await as(VIC).get(`/collections/${id}/comment-counts`);
		expect(counts.body.counts).toEqual({ [nodeId]: 1, collection: 1 });
		const react = (sub: string, method: "put" | "delete") =>
			as(sub).send(
				method,
				`/collections/${id}/comments/${body.id}/reactions/heart`,
			);
		await react(VIC, "put");
		await react(VIC, "put");
		await react(EVE, "put");
		await react(EVE, "delete");
		const [thread] = await threadsOf(VIC, id, `?nodeId=${nodeId}`);
		expect(thread?.comments[0]?.reactions).toEqual([
			{ key: "heart", count: 1, mine: true },
		]);
	});

	it("hides comments from people without a role and items of other collections", async () => {
		const { id, nodeId } = await setup();
		expect((await comment(OLLIE, id, { body: "hi" })).status).toBe(404);
		const other = await createAs(
			EVE,
			(await teamOfThree("Other")).toHexString(),
			{ name: "Other" },
		);
		const res = await comment(EVE, other.id, { nodeId, body: "x" });
		expect(res.status).toBe(404);
	});

	it("slows down one person writing too many comments", async () => {
		const { id } = await setup();
		for (let i = 0; i < 20; i += 1) {
			expect((await comment(VIC, id, { body: `c${i}` })).status).toBe(201);
		}
		const res = await comment(VIC, id, { body: "one more" });
		expect(res.status).toBe(429);
		expect(res.body.error.code).toBe("RATE_LIMITED");
		expect((await comment(EVE, id, { body: "others still can" })).status).toBe(
			201,
		);
	});
});
