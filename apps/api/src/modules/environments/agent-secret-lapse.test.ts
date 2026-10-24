import { beforeEach, describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { ADA, EVE } from "../access/testing/access-fixture.js";
import { registerCollectionAdapter } from "../collections/collection-adapter.js";
import {
	createAs,
	teamOfThree,
} from "../collections/testing/collection-fixture.js";
import {
	createVaultAs,
	fakeCiphertext,
	useSecretVaultOn,
} from "../secret-vault/testing/vault-fixture.js";
import {
	createEnvironmentAs,
	useEnvironmentTestDb,
	variableInput,
} from "./testing/environment-fixture.js";

useEnvironmentTestDb();
useSecretVaultOn();
beforeEach(() => {
	registerCollectionAdapter();
});

async function ok(request: Promise<{ status: number; body: unknown }>) {
	const res = await request;
	expect(res.status, JSON.stringify(res.body)).toBe(200);
	return res.body;
}

const allow = (sub: string, kind: string, id: string, key: string) =>
	ok(
		as(sub).send("put", `/agent-secret-uses/${kind}/${id}/${key}`, {
			hosts: ["api.example.com"],
		}),
	);

const uses = (sub: string, kind: string, id: string) =>
	ok(as(sub).get(`/agent-secret-uses/${kind}/${id}`));

describe("a variable that stops being a secret", () => {
	it("drops everyone's agent uses of it in an environment", async () => {
		const ws = (await teamOfThree()).toHexString();
		const secret = (key: string) =>
			variableInput(key, "s3cret-value", { type: "secret" });
		const env = await createEnvironmentAs(EVE, ws, {
			name: "Staging",
			variables: [secret("token"), secret("key")],
		});
		await allow(EVE, "environment", env.id, "token");
		await allow(EVE, "environment", env.id, "key");
		await allow(ADA, "environment", env.id, "token");
		const put = (variables: object[]) =>
			ok(
				as(EVE).send("put", `/environments/${env.id}/variables`, { variables }),
			);
		await put([variableInput("token", "plain"), secret("key")]);
		expect(await uses(EVE, "environment", env.id)).toEqual({
			uses: [{ key: "key", hosts: ["api.example.com"] }],
		});
		expect(await uses(ADA, "environment", env.id)).toEqual({ uses: [] });
		// Made a secret again: it starts with no hosts.
		await put([secret("token"), secret("key")]);
		expect(await uses(EVE, "environment", env.id)).toEqual({
			uses: [{ key: "key", hosts: ["api.example.com"] }],
		});
	});

	it("drops them when a secret global is removed", async () => {
		const ws = (await teamOfThree()).toHexString();
		const path = `/workspaces/${ws}/globals`;
		await ok(
			as(EVE).send("put", path, {
				variables: [variableInput("token", "s3cret-value", { type: "secret" })],
			}),
		);
		await allow(EVE, "global", ws, "token");
		await ok(
			as(EVE).send("put", path, { variables: [variableInput("host", "x")] }),
		);
		expect(await uses(EVE, "global", ws)).toEqual({ uses: [] });
	});

	it("drops a collection variable's uses and agent copies", async () => {
		const ws = (await teamOfThree()).toHexString();
		const { id } = await createAs(EVE, ws);
		const setVariables = (tokenSecret: boolean) =>
			ok(
				as(EVE).send("patch", `/collections/${id}`, {
					variables: [
						{ key: "token", value: "", secret: tokenSecret },
						{ key: "key", value: "", secret: true },
					],
				}),
			);
		await setVariables(true);
		await createVaultAs(EVE);
		await ok(
			as(EVE).send("patch", `/collections/${id}/local-values`, {
				values: [
					{ key: "token", value: fakeCiphertext(), agentValue: "agent-tok" },
					{ key: "key", value: fakeCiphertext(), agentValue: "agent-key" },
				],
			}),
		);
		await allow(EVE, "collection", id, "token");
		await allow(EVE, "collection", id, "key");
		await setVariables(false);
		expect(await uses(EVE, "collection", id)).toEqual({
			uses: [{ key: "key", hosts: ["api.example.com"] }],
		});
		const local = await ok(as(EVE).get(`/collections/${id}/local-values`));
		expect(local).toMatchObject({
			localValues: [
				{ key: "token", value: expect.any(String) },
				{ key: "key", agentUse: true },
			],
		});
		expect(JSON.stringify(local)).not.toMatch(/"token"[^}]*agentUse/);
	});

	it("drops them when a restore takes the collection back to before", async () => {
		const ws = (await teamOfThree()).toHexString();
		const { id } = await createAs(EVE, ws);
		const setVariables = (secret: boolean) =>
			ok(
				as(EVE).send("patch", `/collections/${id}`, {
					variables: [{ key: "token", value: "", secret }],
				}),
			);
		await setVariables(false);
		const changelog = await ok(as(EVE).get(`/collections/${id}/changelog`));
		const plainChange = (
			changelog as { sessions: { changes: { id: string }[] }[] }
		).sessions[0]?.changes[0]?.id;
		await setVariables(true);
		await allow(EVE, "collection", id, "token");
		await ok(
			as(EVE).send(
				"post",
				`/collections/${id}/changelog/${plainChange}/restore`,
			),
		);
		expect(await uses(EVE, "collection", id)).toEqual({ uses: [] });
	});
});
