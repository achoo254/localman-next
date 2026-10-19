import type { EnvironmentDetail } from "@localman/shared/api-client";
import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { EVE } from "../access/testing/access-fixture.js";
import { teamOfThree } from "../collections/testing/collection-fixture.js";
import {
	duplicateEnvironmentOperation,
	setEnvironmentLocalValuesOperation,
	setEnvironmentVariablesOperation,
} from "./environment-change-operations.js";
import {
	createEnvironmentOperation,
	getEnvironmentOperation,
	listEnvironmentsOperation,
	updateEnvironmentOperation,
} from "./environment-operations.js";
import {
	exportEnvironmentOperation,
	importEnvironmentOperation,
} from "./environment-transfer-operations.js";
import { callAsAgent } from "./testing/agent-caller.js";
import {
	createEnvironmentAs,
	useEnvironmentTestDb,
	variableInput,
} from "./testing/environment-fixture.js";

useEnvironmentTestDb();

const SHARED = "shared-s3cret-9f2c";
const LOCAL = "local-s3cret-7a1d";

/** Eve (Editor) holds a shared secret and her own local secret value. */
async function secretEnvironment() {
	const ws = (await teamOfThree()).toHexString();
	const env = await createEnvironmentAs(EVE, ws, {
		name: "Staging",
		variables: [
			variableInput("baseUrl", "https://staging.test"),
			variableInput("token", SHARED, { type: "secret" }),
		],
	});
	const local = await as(EVE).send(
		"patch",
		`/environments/${env.id}/local-values`,
		{ values: [{ key: "token", value: LOCAL }] },
	);
	expect(local.status, JSON.stringify(local.body)).toBe(200);
	return { ws, env };
}

const browserView = async (id: string): Promise<EnvironmentDetail> =>
	(await as(EVE).get(`/environments/${id}`)).body as EnvironmentDetail;

function expectNoSecret(body: unknown, ...secrets: string[]): void {
	const json = JSON.stringify(body);
	for (const secret of secrets) expect(json).not.toContain(secret);
}

describe("environment secrets read by an agent", () => {
	it("withholds the shared and local secret from get_environment, not from the browser", async () => {
		const { env } = await secretEnvironment();
		const agent = (await callAsAgent(getEnvironmentOperation, EVE, {
			environmentId: env.id,
		})) as EnvironmentDetail;
		expectNoSecret(agent, SHARED, LOCAL);
		expect(agent.variables).toEqual([
			expect.objectContaining({
				key: "baseUrl",
				sharedValue: "https://staging.test",
			}),
			expect.objectContaining({
				key: "token",
				sharedValue: null,
				sharedHidden: true,
			}),
		]);
		expect(agent.localValues).toEqual([
			{ key: "token", value: null, hidden: true },
		]);
		const browser = JSON.stringify(await browserView(env.id));
		expect(browser).toContain(SHARED);
		expect(browser).toContain(LOCAL);
	});

	it("returns no secret from list, export, update and duplicate", async () => {
		const { ws, env } = await secretEnvironment();
		const id = { environmentId: env.id };
		const outputs = await Promise.all([
			callAsAgent(listEnvironmentsOperation, EVE, { workspaceId: ws }),
			callAsAgent(exportEnvironmentOperation, EVE, id),
			callAsAgent(updateEnvironmentOperation, EVE, { ...id, name: "Renamed" }),
			callAsAgent(duplicateEnvironmentOperation, EVE, id),
		]);
		for (const output of outputs) expectNoSecret(output, SHARED, LOCAL);
	});
});

describe("environment secrets written by an agent", () => {
	it("stores the values but never echoes them back", async () => {
		const { env } = await secretEnvironment();
		const token = env.variables.find((variable) => variable.key === "token");
		const shared = await callAsAgent(setEnvironmentVariablesOperation, EVE, {
			environmentId: env.id,
			variables: [{ ...token, sharedValue: "agent-shared-1" }],
		});
		expectNoSecret(shared, "agent-shared-1", LOCAL);
		const local = await callAsAgent(setEnvironmentLocalValuesOperation, EVE, {
			environmentId: env.id,
			values: [
				{ key: "token", value: "agent-local-2" },
				{ key: "plain", value: "visible" },
			],
		});
		expect(local).toEqual({
			localValues: [
				{ key: "token", value: null, hidden: true },
				{ key: "plain", value: "visible" },
			],
		});
		const browser = JSON.stringify(await browserView(env.id));
		expect(browser).toContain("agent-shared-1");
		expect(browser).toContain("agent-local-2");
	});

	it("creates and imports secrets without returning them", async () => {
		const ws = (await teamOfThree()).toHexString();
		const created = await callAsAgent(createEnvironmentOperation, EVE, {
			workspaceId: ws,
			name: "Agent",
			variables: [variableInput("key", "created-s3cret", { type: "secret" })],
		});
		expectNoSecret(created, "created-s3cret");
		const imported = (await callAsAgent(importEnvironmentOperation, EVE, {
			workspaceId: ws,
			environment: {
				name: "Imported",
				values: [
					{
						key: "key",
						value: "imported-s3cret",
						type: "secret",
						enabled: true,
					},
				],
			},
		})) as EnvironmentDetail;
		expectNoSecret(imported, "imported-s3cret");
		expect(JSON.stringify(await browserView(imported.id))).toContain(
			"imported-s3cret",
		);
	});
});
