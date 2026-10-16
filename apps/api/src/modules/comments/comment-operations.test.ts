import type { CommentThreadView } from "@localman/shared/api-client";
import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import {
	ADA,
	EVE,
	OLLIE,
	VIC,
	notificationsOf,
	patchAs,
} from "../access/testing/access-fixture.js";
import {
	addNode,
	createAs,
	draftOf,
	teamOfThree,
	useCollectionTestDb,
} from "../collections/testing/collection-fixture.js";

useCollectionTestDb();

/** A team collection (Ada admin, Eve editor, Vic viewer) with one request. */
async function setup() {
	const ws = (await teamOfThree()).toHexString();
	const { id } = await createAs(EVE, ws, { name: "Orders API" });
	const draft = draftOf("List orders", {
		headers: [
			{ id: "h1", key: "Accept", value: "application/json", enabled: true },
		],
	});
	const req = await addNode(EVE, id, {
		kind: "request",
		parentId: null,
		name: "List orders",
		draft,
	});
	return { id, nodeId: req.id, draft };
}

const comment = (sub: string, id: string, body: object) =>
	as(sub).send("post", `/collections/${id}/comments`, body);

async function threadsOf(
	sub: string,
	id: string,
	query = "",
): Promise<CommentThreadView[]> {
	const res = await as(sub).get(`/collections/${id}/comments${query}`);
	expect(res.status, JSON.stringify(res.body)).toBe(200);
	return (res.body as { threads: CommentThreadView[] }).threads;
}

describe("comments on a collection", () => {
	it("lets a Viewer start a thread and others reply, oldest first", async () => {
		const { id, nodeId } = await setup();
		const first = await comment(VIC, id, { nodeId, body: "Why **GET**?" });
		expect(first.status, JSON.stringify(first.body)).toBe(201);
		const reply = await comment(EVE, id, {
			threadId: first.body.threadId,
			body: "Reads only.",
		});
		expect(reply.status).toBe(201);
		expect(reply.body.nodeId).toBe(nodeId);
		const [thread] = await threadsOf(VIC, id, `?nodeId=${nodeId}`);
		expect(thread?.comments.map((item) => item.body)).toEqual([
			"Why **GET**?",
			"Reads only.",
		]);
		expect(thread?.comments.map((item) => item.authorName)).toEqual([
			"vic",
			"Eve",
		]);
		expect(thread?.comments.map((item) => item.canEdit)).toEqual([true, false]);
		expect(await threadsOf(VIC, id)).toEqual([]);
	});

	it("tells people @mentioned who can open it, and thread authors of a reply", async () => {
		const { id, nodeId } = await setup();
		const first = await comment(VIC, id, {
			nodeId,
			body: "@eve @ollie check this",
		});
		expect((await notificationsOf(EVE)).map((item) => item.type)).toEqual([
			"comment.mentioned",
		]);
		expect(await notificationsOf(OLLIE)).toEqual([]);
		const mention = (await notificationsOf(EVE))[0];
		expect(mention?.params).toEqual({
			author: "vic",
			collection: "Orders API",
			item: "List orders",
		});
		expect(mention?.link).toBe(
			`/elements/collection/${id}?node=${nodeId}&comment=${first.body.id}`,
		);
		await comment(ADA, id, { threadId: first.body.threadId, body: "+1" });
		expect((await notificationsOf(VIC)).map((item) => item.type)).toEqual([
			"comment.replied",
		]);
		// A thread author @mentioned in a reply is told once, as a mention.
		await comment(EVE, id, { threadId: first.body.threadId, body: "@vic ok" });
		expect((await notificationsOf(VIC)).map((item) => item.type)).toEqual([
			"comment.replied",
			"comment.mentioned",
		]);
		expect((await notificationsOf(ADA)).map((item) => item.type)).toEqual([
			"comment.replied",
		]);
	});

	it("resolves and reopens: the author or an Editor, not another Viewer", async () => {
		const { id } = await setup();
		const { body } = await comment(ADA, id, { body: "Rename it?" });
		const resolve = (sub: string, resolved: boolean) =>
			as(sub).send("put", `/collections/${id}/comments/${body.id}/resolution`, {
				resolved,
			});
		expect((await resolve(VIC, true)).status).toBe(403);
		expect((await resolve(EVE, true)).status).toBe(200);
		expect(await threadsOf(VIC, id)).toEqual([]);
		const [resolved] = await threadsOf(VIC, id, "?includeResolved=true");
		expect(resolved?.resolvedBy).toBe(EVE);
		expect((await resolve(ADA, false)).status).toBe(200);
		expect(await threadsOf(VIC, id)).toHaveLength(1);
	});

	it("lets a workspace Admin delete others' comments but never edit them", async () => {
		const { id } = await setup();
		const first = await comment(EVE, id, { body: "Plan" });
		const reply = await comment(VIC, id, {
			threadId: first.body.threadId,
			body: "Ok",
		});
		const path = (commentId: string) =>
			`/collections/${id}/comments/${commentId}`;
		expect(
			(await patchAs(ADA, path(reply.body.id), { body: "x" })).status,
		).toBe(403);
		expect((await as(VIC).send("delete", path(first.body.id))).status).toBe(
			403,
		);
		const dry = await as(ADA).send(
			"delete",
			`${path(first.body.id)}?dryRun=true`,
		);
		expect(dry.body).toEqual({ dryRun: true, deleted: false, thread: true });
		expect(await threadsOf(ADA, id)).toHaveLength(1);
		expect((await as(ADA).send("delete", path(first.body.id))).status).toBe(
			200,
		);
		expect(await threadsOf(ADA, id)).toEqual([]);
		expect(
			(await patchAs(VIC, path(reply.body.id), { body: "x" })).status,
		).toBe(404);
	});

	it("anchors inline comments and marks them outdated once the text moves", async () => {
		const { id, nodeId, draft } = await setup();
		const anchor = {
			part: "headers",
			rowId: "h1",
			field: "value",
			start: 0,
			end: 11,
			quote: "application",
		};
		const wrong = await comment(EVE, id, {
			nodeId,
			body: "x",
			anchor: { ...anchor, quote: "text" },
		});
		expect(wrong.status).toBe(400);
		expect(wrong.body.error.code).toBe("ANCHOR_MISMATCH");
		expect(
			(await comment(EVE, id, { nodeId, body: "XML?", anchor })).status,
		).toBe(201);
		const [fresh] = await threadsOf(EVE, id, `?nodeId=${nodeId}`);
		expect(fresh?.anchor?.outdated).toBe(false);
		await patchAs(EVE, `/collections/${id}/nodes/${nodeId}`, {
			draft: {
				...draft,
				headers: [{ id: "h1", key: "Accept", value: "*/*", enabled: true }],
			},
		});
		const [moved] = await threadsOf(EVE, id, `?nodeId=${nodeId}`);
		expect(moved?.anchor?.outdated).toBe(true);
	});

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
});
