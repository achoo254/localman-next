import type { CommentThreadView } from "@localman/shared/api-client";
import { expect } from "vitest";
import { as } from "../../../test-support/dashboard-test-app.js";
import { EVE } from "../../access/testing/access-fixture.js";
import {
	addNode,
	createAs,
	draftOf,
	teamOfThree,
} from "../../collections/testing/collection-fixture.js";

/** TEST ONLY. */
/** A team collection (Ada admin, Eve editor, Vic viewer) with one request. */
export async function setup() {
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

export const comment = (sub: string, id: string, body: object) =>
	as(sub).send("post", `/collections/${id}/comments`, body);

export async function threadsOf(
	sub: string,
	id: string,
	query = "",
): Promise<CommentThreadView[]> {
	const res = await as(sub).get(`/collections/${id}/comments${query}`);
	expect(res.status, JSON.stringify(res.body)).toBe(200);
	return (res.body as { threads: CommentThreadView[] }).threads;
}
