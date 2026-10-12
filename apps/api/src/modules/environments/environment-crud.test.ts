import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { ElementRoleModel } from "../access/element-role-model.js";
import {
	ADA,
	EVE,
	OLLIE,
	VIC,
	personalWorkspace,
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

const listOf = async (sub: string, ws: string) =>
	as(sub).get(`/workspaces/${ws}/environments`);

describe("environments", () => {
	it("lets Admins and Editors create them; Viewers 403, outsiders 404", async () => {
		const ws = (await teamOfThree()).toHexString();
		const env = await createEnvironmentAs(EVE, ws, {
			name: "Staging",
			color: "green",
		});
		expect(env).toMatchObject({
			name: "Staging",
			color: "green",
			role: "editor",
		});
		const viewer = await as(VIC).send(
			"post",
			`/workspaces/${ws}/environments`,
			{
				name: "Prod",
			},
		);
		expect(viewer.status).toBe(403);
		const outsider = await as(OLLIE).send(
			"post",
			`/workspaces/${ws}/environments`,
			{ name: "Prod" },
		);
		expect(outsider.status).toBe(404);
	});

	it("lists them by name with each caller's role; outsiders see shared ones only", async () => {
		const ws = (await teamOfThree()).toHexString();
		const prod = await createEnvironmentAs(ADA, ws, {
			name: "prod",
			variables: [variableInput("a", "1"), variableInput("b", "2")],
		});
		await createEnvironmentAs(ADA, ws, { name: "Dev" });
		const members = await listOf(VIC, ws);
		expect(members.body.items.map((e: { name: string }) => e.name)).toEqual([
			"Dev",
			"prod",
		]);
		expect(members.body.items[1]).toMatchObject({
			role: "viewer",
			variableCount: 2,
		});
		expect((await listOf(OLLIE, ws)).status).toBe(404);
		await as(ADA).send("post", `/elements/environment/${prod.id}/shares`, {
			usernameOrEmail: "ollie",
			role: "editor",
		});
		const shared = await listOf(OLLIE, ws);
		expect(shared.body.items).toEqual([
			expect.objectContaining({ id: prod.id, role: "editor" }),
		]);
	});

	it("renames and recolors for Editors", async () => {
		const ws = (await teamOfThree()).toHexString();
		const env = await createEnvironmentAs(EVE, ws);
		const res = await as(EVE).send("patch", `/environments/${env.id}`, {
			name: "QA",
			color: "purple",
		});
		expect(res.body).toMatchObject({ name: "QA", color: "purple" });
	});

	it("duplicates, withholding secrets a Viewer could not see", async () => {
		const ws = (await teamOfThree()).toHexString();
		const env = await createEnvironmentAs(EVE, ws, {
			name: "Staging",
			variables: [
				variableInput("host", "api.test"),
				variableInput("token", "s3cret", { type: "secret" }),
			],
		});
		const mine = (await personalWorkspace(VIC)).toHexString();
		const copy = await as(VIC).send(
			"post",
			`/environments/${env.id}/duplicate`,
			{ workspaceId: mine },
		);
		expect(copy.status, JSON.stringify(copy.body)).toBe(201);
		expect(copy.body).toMatchObject({ name: "Staging Copy", role: "editor" });
		expect(
			copy.body.variables.map((v: { sharedValue: unknown }) => v.sharedValue),
		).toEqual(["api.test", null]);
		const editorCopy = await as(EVE).send(
			"post",
			`/environments/${env.id}/duplicate`,
			{},
		);
		expect(editorCopy.body.variables[1]).toMatchObject({
			sharedValue: "s3cret",
			type: "secret",
		});
	});

	it("deletes one for good with its local values, shares and active choices", async () => {
		const ws = (await teamOfThree()).toHexString();
		const env = await createEnvironmentAs(EVE, ws, {
			name: "Staging",
			variables: [variableInput("a", "1"), variableInput("b", "2")],
		});
		await as(VIC).send("patch", `/environments/${env.id}/local-values`, {
			values: [{ key: "a", value: "mine" }],
		});
		await as(VIC).send("put", `/workspaces/${ws}/active-environment`, {
			environmentId: env.id,
		});
		await as(EVE).send("post", `/elements/environment/${env.id}/shares`, {
			usernameOrEmail: "ollie",
			role: "editor",
		});
		// A share alone does not delete: Ollie is not in the workspace.
		expect(
			(await as(OLLIE).send("delete", `/environments/${env.id}`)).status,
		).toBe(403);
		expect(
			(await as(VIC).send("delete", `/environments/${env.id}`)).status,
		).toBe(403);
		const dry = await as(EVE).send(
			"delete",
			`/environments/${env.id}?dryRun=true`,
		);
		expect(dry.body).toMatchObject({
			dryRun: true,
			deleted: false,
			variables: 2,
		});
		expect(await EnvironmentModel.countDocuments()).toBe(1);
		const res = await as(EVE).send("delete", `/environments/${env.id}`);
		expect(res.body).toMatchObject({ deleted: true, name: "Staging" });
		expect(await EnvironmentModel.countDocuments()).toBe(0);
		expect(await LocalVariableValueModel.countDocuments()).toBe(0);
		expect(await ActiveEnvironmentModel.countDocuments()).toBe(0);
		expect(await ElementRoleModel.countDocuments()).toBe(0);
		expect((await as(EVE).get(`/environments/${env.id}`)).status).toBe(404);
	});

	it("answers 404 for an id that is not an environment", async () => {
		const id = new Types.ObjectId().toHexString();
		expect((await as(EVE).get(`/environments/${id}`)).status).toBe(404);
		expect((await as(EVE).get("/environments/not-an-id")).status).toBe(404);
	});
});
