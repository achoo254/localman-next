import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import {
	ADA,
	EVE,
	VIC,
	teamWorkspace,
} from "../access/testing/access-fixture.js";
import { teamOfThree } from "../collections/testing/collection-fixture.js";
import { ActiveEnvironmentModel } from "./active-environment-model.js";
import { EnvironmentModel } from "./environment-model.js";
import { GlobalVariablesModel } from "./global-variables-model.js";
import { LocalVariableValueModel } from "./local-variable-value-model.js";
import {
	createEnvironmentAs,
	useEnvironmentTestDb,
	variableInput,
} from "./testing/environment-fixture.js";

useEnvironmentTestDb();

describe("environments across workspaces", () => {
	it("goes away with its workspace, globals included", async () => {
		const wsId = await teamOfThree();
		const ws = wsId.toHexString();
		await createEnvironmentAs(ADA, ws, { name: "Staging" });
		await as(ADA).send("put", `/workspaces/${ws}/globals`, {
			variables: [variableInput("region", "eu")],
		});
		await as(VIC).send("patch", `/workspaces/${ws}/globals/local-values`, {
			values: [{ key: "region", value: "us" }],
		});
		const dry = await as(ADA).send("delete", `/workspaces/${ws}?dryRun=true`);
		expect(dry.body).toMatchObject({ environments: 1 });
		const res = await as(ADA).send("delete", `/workspaces/${ws}`);
		expect(res.status, JSON.stringify(res.body)).toBe(200);
		expect(res.body).toMatchObject({ environments: 1 });
		expect(await EnvironmentModel.countDocuments()).toBe(0);
		expect(await GlobalVariablesModel.countDocuments()).toBe(0);
		expect(await LocalVariableValueModel.countDocuments()).toBe(0);
	});

	it("moves through the access layer and stops being anyone's active choice", async () => {
		const source = await teamOfThree();
		const target = await teamWorkspace({ [EVE]: "admin" }, "Target");
		const env = await createEnvironmentAs(EVE, source.toHexString());
		await as(VIC).send(
			"put",
			`/workspaces/${source.toHexString()}/active-environment`,
			{ environmentId: env.id },
		);
		const res = await as(EVE).send(
			"post",
			`/elements/environment/${env.id}/move`,
			{ workspaceId: target.toHexString() },
		);
		expect(res.status, JSON.stringify(res.body)).toBe(200);
		const moved = await EnvironmentModel.findById(env.id).lean();
		expect(moved?.workspaceId.equals(target)).toBe(true);
		expect(await ActiveEnvironmentModel.countDocuments()).toBe(0);
		expect((await as(VIC).get(`/environments/${env.id}`)).status).toBe(404);
	});
});
