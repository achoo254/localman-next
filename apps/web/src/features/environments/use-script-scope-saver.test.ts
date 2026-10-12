import type {
	GlobalsDetail,
	LocalValue,
	ScriptScopeChanges,
} from "@localman/shared/api-client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockFetch } from "../../test/mock-fetch";
import { createTestQueryClient } from "../../test/render-app";
import { collectionLocalKey, globalsKey } from "./use-environments";
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

describe("saveScriptScopes", () => {
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
		client.setQueryData(globalsKey("ws-1"), GLOBALS);
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
});
