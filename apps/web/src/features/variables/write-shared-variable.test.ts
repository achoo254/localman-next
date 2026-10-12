import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type MockRoute, mockFetch } from "../../test/mock-fetch";
import { detail } from "../collections/collections-test-utils";
import {
	ENV_PATH,
	GLOBALS,
	environment,
	variable,
} from "../environments/environments-test-utils";
import { type VariableTargets, scopeTarget } from "./variable-targets";
import { writeSharedVariable } from "./write-shared-variable";

afterEach(() => vi.unstubAllGlobals());

const TARGETS: VariableTargets = {
	workspaceId: "w-team",
	environment: { id: "e1", name: "Staging", ...scopeTarget(true, [], []) },
	collection: { id: "c1", name: "Shop", ...scopeTarget(true, [], []) },
	globals: scopeTarget(true, [], []),
};

const client = () =>
	new QueryClient({ defaultOptions: { queries: { retry: false } } });

/** Method and path of every write, in order. */
const writes = (calls: { method: string; path: string }[]) =>
	calls
		.filter((call) => call.method !== "GET")
		.map((call) => `${call.method} ${call.path}`);

describe("writeSharedVariable", () => {
	const disabledWithLocal = environment({
		variables: [variable("token", "old", { enabled: false })],
		localValues: [{ key: "token", value: "mine" }],
	});

	it("replaces an existing shared value, keeps it disabled, then resets the caller's local value", async () => {
		const { calls } = mockFetch({
			[`GET ${ENV_PATH}`]: { body: disabledWithLocal },
			[`PUT ${ENV_PATH}/variables`]: { body: disabledWithLocal },
			[`PATCH ${ENV_PATH}/local-values`]: { body: { localValues: [] } },
		});
		const outcome = await writeSharedVariable(client(), TARGETS, {
			scope: "environment",
			key: "token",
			value: "new",
		});
		expect(outcome).toBe("reset");
		expect(writes(calls)).toEqual([
			`PUT ${ENV_PATH}/variables`,
			`PATCH ${ENV_PATH}/local-values`,
		]);
		const put = calls.find((call) => call.method === "PUT");
		expect(put?.body).toEqual({
			variables: [
				{
					id: "v-token",
					key: "token",
					type: "default",
					enabled: false,
					description: "",
					sharedValue: "new",
				},
			],
		});
		const patch = calls.find((call) => call.method === "PATCH");
		expect(patch?.body).toEqual({ values: [{ key: "token", value: null }] });
	});

	it("leaves local values alone when the shared write fails", async () => {
		const { calls } = mockFetch({
			[`GET ${ENV_PATH}`]: { body: disabledWithLocal },
			[`PUT ${ENV_PATH}/variables`]: {
				status: 403,
				body: { error: { code: "FORBIDDEN", message: "Editors only." } },
			},
		});
		await expect(
			writeSharedVariable(client(), TARGETS, {
				scope: "environment",
				key: "token",
				value: "new",
			}),
		).rejects.toThrow();
		expect(writes(calls)).toEqual([`PUT ${ENV_PATH}/variables`]);
	});

	it("reports a local value it could not reset as kept", async () => {
		const routes: Record<string, MockRoute> = {
			[`GET ${GLOBALS}`]: {
				body: {
					workspaceId: "w-team",
					role: "editor",
					variables: [variable("host", "a")],
					localValues: [{ key: "host", value: "mine" }],
					updatedAt: null,
				},
			},
			[`PUT ${GLOBALS}`]: {
				body: {
					workspaceId: "w-team",
					role: "editor",
					variables: [variable("host", "b")],
					localValues: [{ key: "host", value: "mine" }],
					updatedAt: null,
				},
			},
			[`PATCH ${GLOBALS}/local-values`]: { status: 500, body: {} },
		};
		mockFetch(routes);
		const outcome = await writeSharedVariable(client(), TARGETS, {
			scope: "global",
			key: "host",
			value: "b",
		});
		expect(outcome).toBe("kept");
	});

	it("resets the caller's collection local value after updating the collection", async () => {
		const collection = detail("c1", [], {
			variables: [{ key: "id", value: "1" }],
		});
		const { calls } = mockFetch({
			"GET /api/v1/collections/c1": { body: collection },
			"GET /api/v1/collections/c1/local-values": {
				body: { localValues: [{ key: "id", value: "9" }] },
			},
			"PATCH /api/v1/collections/c1": { body: collection },
			"PATCH /api/v1/collections/c1/local-values": {
				body: { localValues: [] },
			},
		});
		await writeSharedVariable(client(), TARGETS, {
			scope: "collection",
			key: "id",
			value: "2",
		});
		expect(writes(calls)).toEqual([
			"PATCH /api/v1/collections/c1",
			"PATCH /api/v1/collections/c1/local-values",
		]);
		expect(
			calls.find(
				(c) => c.path === "/api/v1/collections/c1" && c.method === "PATCH",
			)?.body,
		).toEqual({
			variables: [{ key: "id", value: "2" }],
		});
	});
});
