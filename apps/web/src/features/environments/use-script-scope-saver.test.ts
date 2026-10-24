import type {
	GlobalsDetail,
	LocalValue,
	ScriptScopeChanges,
} from "@localman/shared/api-client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockFetch } from "../../test/mock-fetch";
import { createTestQueryClient } from "../../test/render-app";
import { collectionKey } from "../collections/use-collections";
import { resetVaultSession } from "../secure-vault/vault-session";
import { environment, variable } from "./environments-test-utils";
import {
	collectionLocalKey,
	environmentKey,
	globalsKey,
} from "./use-environments";
import { saveScriptScopes } from "./use-script-scope-saver";

const CHANGES: ScriptScopeChanges = {
	globals: [{ key: "token", value: "abc" }],
	collectionVariables: [{ key: "page", value: null }],
	environment: [{ key: "host", value: "prod.test" }],
};

const TARGETS = {
	workspaceId: "ws-1",
	environmentId: "env-1",
	collectionId: "col-1",
};

const GLOBALS: GlobalsDetail = {
	workspaceId: "ws-1",
	role: "viewer",
	variables: [],
	localValues: [],
	updatedAt: null,
};

const answer = (localValues: LocalValue[]) => ({ body: { localValues } });

/** The scopes' variables, as a table open on the page would cache them. */
function cached(client: ReturnType<typeof createTestQueryClient>) {
	client.setQueryData(globalsKey("ws-1"), GLOBALS);
	client.setQueryData(
		environmentKey("env-1"),
		environment({ id: "env-1", variables: [], localValues: [] }),
	);
	client.setQueryData(collectionKey("col-1"), { variables: [] });
	client.setQueryData(collectionLocalKey("col-1"), []);
}

describe("saveScriptScopes", () => {
	beforeEach(() => resetVaultSession());
	afterEach(() => vi.unstubAllGlobals());

	it("writes each changed scope as local values and caches the answers", async () => {
		const { calls } = mockFetch({
			"PATCH /api/v1/workspaces/ws-1/globals/local-values": answer([
				{ key: "token", value: "abc" },
			]),
			"PATCH /api/v1/environments/env-1/local-values": answer([
				{ key: "host", value: "prod.test" },
			]),
			"PATCH /api/v1/collections/col-1/local-values": answer([]),
		});
		const client = createTestQueryClient();
		cached(client);
		expect(await saveScriptScopes(client, TARGETS, CHANGES)).toEqual({
			saved: true,
			dropped: [],
		});
		expect(calls.map((call) => [call.path, call.body])).toEqual(
			expect.arrayContaining([
				[
					"/api/v1/workspaces/ws-1/globals/local-values",
					{ values: [{ key: "token", value: "abc" }] },
				],
				[
					"/api/v1/environments/env-1/local-values",
					{ values: [{ key: "host", value: "prod.test" }] },
				],
				[
					"/api/v1/collections/col-1/local-values",
					{ values: [{ key: "page", value: null }] },
				],
			]),
		);
		expect(
			client.getQueryData<GlobalsDetail>(globalsKey("ws-1"))?.localValues,
		).toEqual([{ key: "token", value: "abc" }]);
		expect(client.getQueryData(collectionLocalKey("col-1"))).toEqual([]);
	});

	it("skips a scope with nowhere to save and reports a failed write", async () => {
		const { calls } = mockFetch({
			"PATCH /api/v1/workspaces/ws-1/globals/local-values": { status: 500 },
		});
		const client = createTestQueryClient();
		cached(client);
		const saved = await saveScriptScopes(
			client,
			{ workspaceId: "ws-1", environmentId: null, collectionId: null },
			CHANGES,
		);
		// No environment, no collection: those scopes are reported dropped.
		expect(saved).toEqual({
			saved: false,
			dropped: ["environment", "collectionVariables"],
		});
		expect(calls.map((call) => call.path)).toEqual([
			"/api/v1/workspaces/ws-1/globals/local-values",
		]);
	});

	it("writes nothing to a scope whose secret names it cannot read", async () => {
		const { calls } = mockFetch({
			"GET /api/v1/workspaces/ws-1/globals": { status: 500 },
		});
		const client = createTestQueryClient();
		const saved = await saveScriptScopes(
			client,
			{ workspaceId: "ws-1", environmentId: null, collectionId: null },
			{ globals: CHANGES.globals, environment: [], collectionVariables: [] },
		);
		expect(saved).toEqual({ saved: false, dropped: [] });
		expect(calls.filter((call) => call.method === "PATCH")).toEqual([]);
	});

	it("carries the agents' copy of a secret the server keeps one of", async () => {
		const { calls } = mockFetch({
			"PATCH /api/v1/workspaces/ws-1/globals/local-values": answer([]),
		});
		const client = createTestQueryClient();
		client.setQueryData(globalsKey("ws-1"), {
			...GLOBALS,
			variables: [variable("token", null, { type: "secret" })],
			localValues: [{ key: "token", value: "old", agentUse: true }],
		});
		await saveScriptScopes(client, TARGETS, {
			globals: [{ key: "token", value: "abc" }],
			environment: [],
			collectionVariables: [],
		});
		expect(calls.find((call) => call.method === "PATCH")?.body).toEqual({
			values: [{ key: "token", value: "abc", agentValue: "abc" }],
		});
	});
});
