import type { EnvironmentDetail } from "@localman/shared/api-client";
import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { EVE } from "../access/testing/access-fixture.js";
import { teamOfThree } from "../collections/testing/collection-fixture.js";
import { setEnvironmentVariablesOperation } from "./environment-change-operations.js";
import { getEnvironmentOperation } from "./environment-operations.js";
import { setGlobalsOperation } from "./globals-operations.js";
import { callAsAgent } from "./testing/agent-caller.js";
import {
	createEnvironmentAs,
	useEnvironmentTestDb,
	variableInput,
} from "./testing/environment-fixture.js";

useEnvironmentTestDb();

const LOCAL = "local-s3cret-91fd";

/** Eve's environment with a secret and her own (server-sealed) value of it. */
async function secretEnvironment(): Promise<{ ws: string; id: string }> {
	const ws = (await teamOfThree()).toHexString();
	const env = await createEnvironmentAs(EVE, ws, {
		name: "Staging",
		variables: [variableInput("token", "shared-9b2e", { type: "secret" })],
	});
	await as(EVE)
		.send("patch", `/environments/${env.id}/local-values`, {
			values: [{ key: "token", value: LOCAL }],
		})
		.expect(200);
	return { ws, id: env.id };
}

describe("an agent cannot make a secret plain", () => {
	it("refuses turning it into another type or removing it", async () => {
		const { id } = await secretEnvironment();
		const read = (await callAsAgent(getEnvironmentOperation, EVE, {
			environmentId: id,
		})) as EnvironmentDetail;
		const plain = read.variables.map((variable) => ({
			...variable,
			type: "default" as const,
		}));
		await expect(
			callAsAgent(setEnvironmentVariablesOperation, EVE, {
				environmentId: id,
				variables: plain,
			}),
		).rejects.toMatchObject({ code: "SECRET_LAPSE_AGENT" });
		await expect(
			callAsAgent(setEnvironmentVariablesOperation, EVE, {
				environmentId: id,
				variables: [],
			}),
		).rejects.toMatchObject({ code: "SECRET_LAPSE_AGENT" });

		// Nothing was opened: the agent still reads no secret value.
		const after = JSON.stringify(
			await callAsAgent(getEnvironmentOperation, EVE, { environmentId: id }),
		);
		expect(after).not.toContain(LOCAL);
	});

	it("refuses it for globals too", async () => {
		const { ws } = await secretEnvironment();
		await as(EVE)
			.send("put", `/workspaces/${ws}/globals`, {
				variables: [variableInput("key", "g-7d1", { type: "secret" })],
			})
			.expect(200);
		await expect(
			callAsAgent(setGlobalsOperation, EVE, {
				workspaceId: ws,
				variables: [variableInput("key", "g-7d1")],
			}),
		).rejects.toMatchObject({ code: "SECRET_LAPSE_AGENT" });
	});

	it("leaves the user free to do it in the browser", async () => {
		const { id } = await secretEnvironment();
		await as(EVE)
			.send("put", `/environments/${id}/variables`, {
				variables: [variableInput("token", "shared-9b2e")],
			})
			.expect(200);
	});
});
