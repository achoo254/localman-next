import { beforeEach, describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { EVE } from "../access/testing/access-fixture.js";
import { callAsAgent } from "../environments/testing/agent-caller.js";
import {
	createEnvironmentAs,
	useEnvironmentTestDb,
	variableInput,
} from "../environments/testing/environment-fixture.js";
import { UserModel } from "../users/user-model.js";
import {
	forkCollectionOperation,
	forkEnvironmentOperation,
} from "../version-control/fork-operations.js";
import { registerCollectionAdapter } from "./collection-adapter.js";
import {
	duplicateCollectionOperation,
	updateCollectionOperation,
} from "./collection-write-operations.js";
import { createAs, teamOfThree } from "./testing/collection-fixture.js";

useEnvironmentTestDb();
beforeEach(async () => {
	registerCollectionAdapter();
	await UserModel.updateMany(
		{},
		{ $set: { plan: "pro", planExpiresAt: null } },
	);
});

const SECRET = "collection-s3cret-77d1";

const expectNoSecret = (output: unknown): void =>
	expect(JSON.stringify(output)).not.toContain(SECRET);

/** Eve's team collection holding a secret variable. */
async function secretCollection(): Promise<{ ws: string; id: string }> {
	const ws = (await teamOfThree()).toHexString();
	const { id } = await createAs(EVE, ws);
	const res = await as(EVE).send("patch", `/collections/${id}`, {
		variables: [{ key: "token", value: SECRET, secret: true }],
	});
	expect(res.status, JSON.stringify(res.body)).toBe(200);
	return { ws, id };
}

describe("collection writes do not give an agent its secrets back", () => {
	it("update, duplicate and fork return the secret blanked", async () => {
		const { ws, id } = await secretCollection();
		// An edit that changes nothing must not read the secret back either.
		expectNoSecret(
			await callAsAgent(updateCollectionOperation, EVE, {
				collectionId: id,
				description: "",
			}),
		);
		expectNoSecret(
			await callAsAgent(duplicateCollectionOperation, EVE, {
				collectionId: id,
				workspaceId: ws,
			}),
		);
		expectNoSecret(
			await callAsAgent(forkCollectionOperation, EVE, {
				collectionId: id,
				label: "agent",
				workspaceId: ws,
			}),
		);
		// The browser still sees the value it owns.
		const web = await as(EVE).get(`/collections/${id}`);
		expect(JSON.stringify(web.body)).toContain(SECRET);
	});

	it("an environment forked by an agent comes back withheld", async () => {
		const ws = (await teamOfThree()).toHexString();
		const env = await createEnvironmentAs(EVE, ws, {
			name: "Staging",
			variables: [variableInput("token", SECRET, { type: "secret" })],
		});
		expectNoSecret(
			await callAsAgent(forkEnvironmentOperation, EVE, {
				environmentId: env.id,
				label: "agent",
				workspaceId: ws,
			}),
		);
	});
});
