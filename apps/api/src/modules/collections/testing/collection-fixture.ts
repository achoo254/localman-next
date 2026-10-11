import {
	type ApiRequestDraft,
	type CollectionDetail,
	createRequestDraft,
} from "@localman/shared/api-client";
import { beforeEach, expect } from "vitest";
import { as } from "../../../test-support/dashboard-test-app.js";
import {
	ADA,
	EVE,
	VIC,
	teamWorkspace,
	useAccessTestDb,
} from "../../access/testing/access-fixture.js";
import { registerCollectionAdapter } from "../collection-adapter.js";

/**
 * TEST ONLY. The access test database (users Ada, Eve, Vic, Ollie, Una)
 * with the real collection adapter in place of the fake one.
 */
export function useCollectionTestDb(): void {
	useAccessTestDb();
	beforeEach(() => {
		registerCollectionAdapter();
	});
}

/** A team workspace with Ada (admin), Eve (editor) and Vic (viewer). */
export function teamOfThree(name = "Team") {
	return teamWorkspace(
		{ [ADA]: "admin", [EVE]: "editor", [VIC]: "viewer" },
		name,
	);
}

export const draftOf = (
	name: string,
	overrides: Partial<ApiRequestDraft> = {},
): ApiRequestDraft =>
	createRequestDraft({ name, url: "https://api.example.com", ...overrides });

/** Creates a collection as `sub` (expects 201) and returns it. */
export async function createAs(
	sub: string,
	workspaceId: string,
	body: object = { name: "Orders API" },
): Promise<CollectionDetail> {
	const res = await as(sub).send(
		"post",
		`/workspaces/${workspaceId}/collections`,
		body,
	);
	expect(res.status, JSON.stringify(res.body)).toBe(201);
	return res.body as CollectionDetail;
}

/** Adds a node as `sub` (expects 201) and returns its id and order. */
export async function addNode(
	sub: string,
	collectionId: string,
	body: object,
): Promise<{ id: string; order: string }> {
	const res = await as(sub).send(
		"post",
		`/collections/${collectionId}/nodes`,
		body,
	);
	expect(res.status, JSON.stringify(res.body)).toBe(201);
	return res.body as { id: string; order: string };
}

export const folder = (name: string, parentId: string | null = null) => ({
	kind: "folder",
	parentId,
	name,
});

export const requestNode = (name: string, parentId: string | null = null) => ({
	kind: "request",
	parentId,
	name,
	draft: draftOf(name),
});

/** A team collection with no nodes, created by Eve; returns its id. */
export async function emptyCollection(): Promise<string> {
	const ws = (await teamOfThree()).toHexString();
	return (await createAs(EVE, ws, { name: "Nodes" })).id;
}

/** Moves a node as Eve (an Editor of `teamOfThree`). */
export const moveAsEve = (id: string, nodeId: string, body: object) =>
	as(EVE).send("post", `/collections/${id}/nodes/${nodeId}/move`, body);

export const trashOf = (sub: string, query = "") =>
	as(sub).get(`/trash/collections${query}`);

export const restoreAs = (sub: string, id: string, workspaceId: string) =>
	as(sub).send("post", `/trash/collections/${id}/restore`, { workspaceId });

/** A REST CRUD collection of `teamOfThree`, deleted by Eve. */
export async function trashedCrud(): Promise<{ ws: string; id: string }> {
	const ws = (await teamOfThree()).toHexString();
	const { id } = await createAs(ADA, ws, { template: "rest-crud" });
	const res = await as(EVE).send("delete", `/collections/${id}`, {
		confirm: "delete",
	});
	expect(res.status, JSON.stringify(res.body)).toBe(200);
	return { ws, id };
}
