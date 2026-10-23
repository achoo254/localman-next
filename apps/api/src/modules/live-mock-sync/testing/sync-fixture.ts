import type {
	CollectionDetail,
	CollectionNode,
	EnvironmentDetail,
} from "@localman/shared/api-client";
import { beforeEach, expect } from "vitest";
import { createLogger } from "../../../logger.js";
import { as } from "../../../test-support/dashboard-test-app.js";
import { ADA, EVE, VIC } from "../../access/testing/access-fixture.js";
import {
	teamOfThree,
	useCollectionTestDb,
} from "../../collections/testing/collection-fixture.js";
import { registerEnvironmentAdapter } from "../../environments/environment-access.js";
import {
	testKeyring,
	useVariableKeyring,
} from "../../environments/testing/environment-fixture.js";
import {
	createProject,
	createResource,
	resourcesPath,
} from "../../resources/testing/resource-fixture.js";
import { syncProject } from "../sync-job.js";

export { ADA, EVE, VIC };

/**
 * TEST ONLY. Collections and environments for real, a team where Ada is
 * Admin, Eve Editor and Vic Viewer.
 */
export function useSyncTestDb(): void {
	useCollectionTestDb();
	beforeEach(() => {
		registerEnvironmentAdapter();
		useVariableKeyring(testKeyring());
	});
}

export interface Synced {
	readonly ws: string;
	readonly project: string;
	readonly users: string;
	readonly collection: string;
	readonly environment: string;
}

/** Eve's project with `users`, synced into the team as Eve. */
export async function syncedUsers(): Promise<Synced> {
	const ws = (await teamOfThree()).toHexString();
	const project = await createProject(EVE, "Shop");
	const users = await createResource(EVE, project, {
		name: "users",
		schema: [{ name: "name", type: "String" }],
	});
	const res = await as(EVE).send(
		"post",
		`/projects/${project}/synced-collections`,
		{ workspaceId: ws },
	);
	expect(res.status, JSON.stringify(res.body)).toBe(201);
	return {
		ws,
		project,
		users: users.id,
		collection: res.body.collectionId as string,
		environment: res.body.environmentId as string,
	};
}

/** What the debounced job does, at once. */
export const syncNow = (project: string): Promise<boolean> =>
	syncProject(project, createLogger("silent"));

export async function collectionOf(
	sub: string,
	id: string,
): Promise<CollectionDetail> {
	const res = await as(sub).get(`/collections/${id}`);
	expect(res.status, JSON.stringify(res.body)).toBe(200);
	return res.body as CollectionDetail;
}

export async function environmentOf(
	sub: string,
	id: string,
): Promise<EnvironmentDetail> {
	const res = await as(sub).get(`/environments/${id}`);
	expect(res.status, JSON.stringify(res.body)).toBe(200);
	return res.body as EnvironmentDetail;
}

export function requestNamed(
	detail: CollectionDetail,
	name: string,
): Extract<CollectionNode, { kind: "request" }> {
	const node = detail.nodes.find(
		(n) => n.kind === "request" && n.name === name,
	);
	if (node?.kind !== "request") throw new Error(`no request "${name}"`);
	return node;
}

export const renameResource = (s: Synced, name: string) =>
	as(EVE).send("put", resourcesPath(s.project, `/${s.users}`), {
		name,
		schema: [{ name: "name", type: "String" }],
	});
