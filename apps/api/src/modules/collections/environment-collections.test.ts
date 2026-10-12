import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	DEFAULT_RUNTIME_SETTINGS,
	configureRuntime,
} from "../../config/runtime-settings.js";
import { as } from "../../test-support/dashboard-test-app.js";
import { ADA, OLLIE, VIC, patchAs } from "../access/testing/access-fixture.js";
import { registerEnvironmentAdapter } from "../environments/environment-access.js";
import {
	createEnvironmentAs,
	testKeyring,
	useVariableKeyring,
} from "../environments/testing/environment-fixture.js";
import {
	createAs,
	teamOfThree,
	useCollectionTestDb,
} from "./testing/collection-fixture.js";

useCollectionTestDb();
beforeEach(() => {
	registerEnvironmentAdapter();
	useVariableKeyring(testKeyring());
});
afterEach(() => configureRuntime(DEFAULT_RUNTIME_SETTINGS));

const usesOf = async (sub: string, envId: string) => {
	const res = await as(sub).get(`/environments/${envId}/collections`);
	return { status: res.status, items: res.body.items };
};

const share = (path: string, body: object) =>
	as(ADA).send("post", `${path}/shares`, {
		usernameOrEmail: "ollie",
		role: "viewer",
		...body,
	});

describe("client.listEnvironmentCollections", () => {
	it("lists the collections using an environment, linked over shared", async () => {
		const ws = (await teamOfThree()).toHexString();
		const staging = await createEnvironmentAs(ADA, ws, { name: "Staging" });
		const prod = await createEnvironmentAs(ADA, ws, { name: "Prod" });
		const orders = await createAs(ADA, ws, { name: "Orders" });
		const billing = await createAs(ADA, ws, { name: "Billing" });
		const users = await createAs(ADA, ws, { name: "Users" });
		const gone = await createAs(ADA, ws, { name: "Gone" });
		await patchAs(ADA, `/collections/${orders.id}`, {
			linkedEnvironmentId: staging.id,
		});
		// Shared with Staging, but an Editor linked Prod: Prod wins.
		await share(`/elements/collection/${users.id}`, {
			includeEnvironmentId: staging.id,
		});
		await patchAs(ADA, `/collections/${users.id}`, {
			linkedEnvironmentId: prod.id,
		});
		// Shared with Staging and nothing linked: it counts.
		await share(`/elements/collection/${billing.id}`, {
			includeEnvironmentId: staging.id,
		});
		await patchAs(ADA, `/collections/${gone.id}`, {
			linkedEnvironmentId: staging.id,
		});
		const trashed = await as(ADA).send("delete", `/collections/${gone.id}`, {});
		expect(trashed.status, JSON.stringify(trashed.body)).toBe(200);

		// A workspace Viewer sees every collection there.
		expect(await usesOf(VIC, staging.id)).toEqual({
			status: 200,
			items: [
				{ id: billing.id, name: "Billing", source: "shared" },
				{ id: orders.id, name: "Orders", source: "linked" },
			],
		});
		expect((await usesOf(VIC, prod.id)).items).toEqual([
			{ id: users.id, name: "Users", source: "linked" },
		]);
		// Ollie holds Staging and Billing (shared), not Orders.
		expect(await usesOf(OLLIE, staging.id)).toEqual({
			status: 200,
			items: [{ id: billing.id, name: "Billing", source: "shared" }],
		});
		// Prod was never shared with him.
		expect((await usesOf(OLLIE, prod.id)).status).toBe(404);
	});
});
