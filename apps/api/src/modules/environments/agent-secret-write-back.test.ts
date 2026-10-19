import type {
	EnvironmentDetail,
	GlobalsDetail,
} from "@localman/shared/api-client";
import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { EVE } from "../access/testing/access-fixture.js";
import { teamOfThree } from "../collections/testing/collection-fixture.js";
import {
	setEnvironmentLocalValuesOperation,
	setEnvironmentVariablesOperation,
} from "./environment-change-operations.js";
import { getEnvironmentOperation } from "./environment-operations.js";
import {
	getGlobalsOperation,
	setGlobalsLocalValuesOperation,
	setGlobalsOperation,
} from "./globals-operations.js";
import { callAsAgent } from "./testing/agent-caller.js";
import {
	createEnvironmentAs,
	useEnvironmentTestDb,
	variableInput,
} from "./testing/environment-fixture.js";

useEnvironmentTestDb();

const SHARED = "shared-s3cret-3c71";
const LOCAL = "local-s3cret-e4a2";

const secretVariables = [
	variableInput("baseUrl", "https://staging.test"),
	variableInput("token", SHARED, { type: "secret" }),
];

/** Eve's environment holding a shared secret and her local secret value. */
async function secretEnvironment(): Promise<string> {
	const ws = (await teamOfThree()).toHexString();
	const env = await createEnvironmentAs(EVE, ws, {
		name: "Staging",
		variables: secretVariables,
	});
	await as(EVE)
		.send("patch", `/environments/${env.id}/local-values`, {
			values: [{ key: "token", value: LOCAL }],
		})
		.expect(200);
	return env.id;
}

const browserJson = async (path: string): Promise<string> =>
	JSON.stringify((await as(EVE).get(path)).body);

describe("environment secrets written back by an agent", () => {
	it("keeps the shared and local secret it sent back as read", async () => {
		const id = await secretEnvironment();
		const read = (await callAsAgent(getEnvironmentOperation, EVE, {
			environmentId: id,
		})) as EnvironmentDetail;
		await callAsAgent(setEnvironmentVariablesOperation, EVE, {
			environmentId: id,
			variables: [...read.variables, variableInput("region", "eu")],
		});
		await callAsAgent(setEnvironmentLocalValuesOperation, EVE, {
			environmentId: id,
			values: [...read.localValues, { key: "region", value: "us" }],
		});
		const browser = await browserJson(`/environments/${id}`);
		expect(browser).toContain(SHARED);
		expect(browser).toContain(LOCAL);
		expect(browser).toContain('"region"');
	});

	it("matches a secret sent back without its id by name", async () => {
		const id = await secretEnvironment();
		await callAsAgent(setEnvironmentVariablesOperation, EVE, {
			environmentId: id,
			variables: [variableInput("token", null, { type: "secret" })],
		});
		expect(await browserJson(`/environments/${id}`)).toContain(SHARED);
	});

	it("still replaces a secret with a real value", async () => {
		const id = await secretEnvironment();
		await callAsAgent(setEnvironmentVariablesOperation, EVE, {
			environmentId: id,
			variables: [variableInput("token", "rotated-2", { type: "secret" })],
		});
		const browser = await browserJson(`/environments/${id}`);
		expect(browser).toContain("rotated-2");
		expect(browser).not.toContain(SHARED);
	});

	it("leaves the browser's `null` meaning unshared", async () => {
		const id = await secretEnvironment();
		await as(EVE)
			.send("put", `/environments/${id}/variables`, {
				variables: [variableInput("token", null, { type: "secret" })],
			})
			.expect(200);
		expect(await browserJson(`/environments/${id}`)).not.toContain(SHARED);
	});
});

describe("global secrets written back by an agent", () => {
	it("keeps the shared and local secret it sent back as read", async () => {
		const ws = (await teamOfThree()).toHexString();
		const path = `/workspaces/${ws}/globals`;
		await as(EVE).send("put", path, { variables: secretVariables }).expect(200);
		await as(EVE)
			.send("patch", `${path}/local-values`, {
				values: [{ key: "token", value: LOCAL }],
			})
			.expect(200);
		const read = (await callAsAgent(getGlobalsOperation, EVE, {
			workspaceId: ws,
		})) as GlobalsDetail;
		expect(JSON.stringify(read)).not.toContain(SHARED);
		await callAsAgent(setGlobalsOperation, EVE, {
			workspaceId: ws,
			variables: [...read.variables, variableInput("region", "eu")],
		});
		await callAsAgent(setGlobalsLocalValuesOperation, EVE, {
			workspaceId: ws,
			values: read.localValues,
		});
		const browser = await browserJson(path);
		expect(browser).toContain(SHARED);
		expect(browser).toContain(LOCAL);
		expect(browser).toContain('"region"');
	});
});
