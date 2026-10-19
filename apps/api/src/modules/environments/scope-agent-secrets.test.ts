import { beforeEach, describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { EVE } from "../access/testing/access-fixture.js";
import { registerCollectionAdapter } from "../collections/collection-adapter.js";
import {
	exportCollectionOperation,
	getCollectionOperation,
} from "../collections/collection-read-operations.js";
import {
	createAs,
	teamOfThree,
} from "../collections/testing/collection-fixture.js";
import {
	getGlobalsOperation,
	setGlobalsLocalValuesOperation,
	setGlobalsOperation,
} from "./globals-operations.js";
import { callAsAgent } from "./testing/agent-caller.js";
import {
	useEnvironmentTestDb,
	variableInput,
} from "./testing/environment-fixture.js";
import {
	getCollectionLocalValuesOperation,
	setCollectionLocalValuesOperation,
} from "./variable-scope-operations.js";

useEnvironmentTestDb();
beforeEach(() => {
	registerCollectionAdapter();
});

const SHARED = "shared-s3cret-4b8e";
const LOCAL = "local-s3cret-0c3f";
const WITHHELD = { key: "token", value: null, hidden: true };

async function ok(request: Promise<{ status: number; body: unknown }>) {
	const res = await request;
	expect(res.status, JSON.stringify(res.body)).toBe(200);
	return res.body;
}

function expectNoSecret(body: unknown, ...secrets: string[]): void {
	const json = JSON.stringify(body);
	for (const secret of secrets) expect(json).not.toContain(secret);
}

describe("globals read and written by an agent", () => {
	it("withholds the shared and local secret; the browser still gets them", async () => {
		const ws = (await teamOfThree()).toHexString();
		const path = `/workspaces/${ws}/globals`;
		await ok(
			as(EVE).send("put", path, {
				variables: [variableInput("token", SHARED, { type: "secret" })],
			}),
		);
		await ok(
			as(EVE).send("patch", `${path}/local-values`, {
				values: [{ key: "token", value: LOCAL }],
			}),
		);
		const read = await callAsAgent(getGlobalsOperation, EVE, {
			workspaceId: ws,
		});
		expectNoSecret(read, SHARED, LOCAL);
		expect(read).toMatchObject({
			variables: [{ key: "token", sharedValue: null, sharedHidden: true }],
			localValues: [WITHHELD],
		});
		const browser = JSON.stringify(await ok(as(EVE).get(path)));
		expect(browser).toContain(SHARED);
		expect(browser).toContain(LOCAL);

		const set = await callAsAgent(setGlobalsOperation, EVE, {
			workspaceId: ws,
			variables: [variableInput("token", "agent-shared", { type: "secret" })],
		});
		expectNoSecret(set, "agent-shared", LOCAL);
		const local = await callAsAgent(setGlobalsLocalValuesOperation, EVE, {
			workspaceId: ws,
			values: [{ key: "token", value: "agent-local" }],
		});
		expect(local).toEqual({ localValues: [WITHHELD] });
		const after = JSON.stringify(await ok(as(EVE).get(path)));
		expect(after).toContain("agent-shared");
		expect(after).toContain("agent-local");
	});
});

describe("collection variables read and written by an agent", () => {
	async function secretCollection(): Promise<string> {
		const ws = (await teamOfThree()).toHexString();
		const { id } = await createAs(EVE, ws);
		await ok(
			as(EVE).send("patch", `/collections/${id}`, {
				variables: [
					{ key: "token", value: SHARED, secret: true },
					{ key: "host", value: "api.test" },
				],
			}),
		);
		await ok(
			as(EVE).send("patch", `/collections/${id}/local-values`, {
				values: [{ key: "token", value: LOCAL }],
			}),
		);
		return id;
	}

	it("blanks a secret variable and withholds its local value", async () => {
		const id = await secretCollection();
		const input = { collectionId: id };
		const detail = await callAsAgent(getCollectionOperation, EVE, input);
		expectNoSecret(detail, SHARED, LOCAL);
		expect(detail).toMatchObject({
			variables: [
				{ key: "token", value: "", secret: true },
				{ key: "host", value: "api.test" },
			],
		});
		expectNoSecret(
			await callAsAgent(exportCollectionOperation, EVE, input),
			SHARED,
		);
		expect(
			await callAsAgent(getCollectionLocalValuesOperation, EVE, input),
		).toEqual({ localValues: [WITHHELD] });
		expect(
			JSON.stringify(await ok(as(EVE).get(`/collections/${id}`))),
		).toContain(SHARED);
		expect(
			JSON.stringify(await ok(as(EVE).get(`/collections/${id}/local-values`))),
		).toContain(LOCAL);
	});

	it("stores a local secret an agent writes without echoing it", async () => {
		const id = await secretCollection();
		const set = await callAsAgent(setCollectionLocalValuesOperation, EVE, {
			collectionId: id,
			values: [
				{ key: "token", value: "agent-local" },
				{ key: "host", value: "local.test" },
			],
		});
		expect(set).toEqual({
			localValues: [WITHHELD, { key: "host", value: "local.test" }],
		});
		expect(
			JSON.stringify(await ok(as(EVE).get(`/collections/${id}/local-values`))),
		).toContain("agent-local");
	});
});
