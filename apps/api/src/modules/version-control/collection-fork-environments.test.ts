import {
	type CollectionDetail,
	ENVIRONMENTS_PER_WORKSPACE_MAX,
	type EnvironmentDetail,
	type EnvironmentSummary,
} from "@localman/shared/api-client";
import { beforeEach, describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { ElementRoleModel } from "../access/element-role-model.js";
import {
	ADA,
	EVE,
	VIC,
	personalWorkspace,
	teamWorkspace,
} from "../access/testing/access-fixture.js";
import { registerCollectionAdapter } from "../collections/collection-adapter.js";
import {
	createAs,
	teamOfThree,
} from "../collections/testing/collection-fixture.js";
import { EnvironmentModel } from "../environments/environment-model.js";
import {
	createEnvironmentAs,
	useEnvironmentTestDb,
	variableInput,
} from "../environments/testing/environment-fixture.js";
import { UserModel } from "../users/user-model.js";
import { ForkModel } from "./fork-model.js";

useEnvironmentTestDb();

beforeEach(async () => {
	registerCollectionAdapter();
	await UserModel.updateMany(
		{},
		{ $set: { plan: "pro", planExpiresAt: null } },
	);
});

/** Ada's team collection and one environment, plus Eve's personal workspace. */
async function setup() {
	const ws = (await teamOfThree()).toHexString();
	const collection = await createAs(ADA, ws, { name: "Orders API" });
	const env = await createEnvironmentAs(ADA, ws, {
		name: "Staging",
		variables: [
			variableInput("baseUrl", "https://a.test"),
			variableInput("token", "s3cret", { type: "secret" }),
		],
	});
	return { ws, collection: collection.id, env: env.id };
}

const environmentsOf = async (sub: string, ws: string) =>
	(
		(await as(sub).get(`/workspaces/${ws}/environments`)).body as {
			items: EnvironmentSummary[];
		}
	).items;

describe("forking a collection with environments", () => {
	it("forks each environment along with it, linked to its source", async () => {
		const { ws, collection, env } = await setup();
		const own = (await personalWorkspace(EVE)).toHexString();
		const res = await as(EVE).send("post", `/collections/${collection}/forks`, {
			label: "eve",
			workspaceId: own,
			environmentIds: [env],
		});
		expect(res.status, JSON.stringify(res.body)).toBe(201);
		expect((res.body as CollectionDetail).id).not.toBe(collection);
		const copies = await environmentsOf(EVE, own);
		expect(copies.map((copy) => copy.name)).toEqual(["Staging"]);
		const link = await ForkModel.findOne({ kind: "environment" }).lean();
		expect(link?.sourceId.toHexString()).toBe(env);
		expect(link?.label).toBe("eve");
		expect(await environmentsOf(ADA, ws)).toHaveLength(1);
	});

	it("checks every environment before creating anything", async () => {
		const { collection } = await setup();
		const elsewhere = (await personalWorkspace(ADA)).toHexString();
		const stray = await createEnvironmentAs(ADA, elsewhere, { name: "Mine" });
		const own = (await personalWorkspace(EVE)).toHexString();
		const res = await as(EVE).send("post", `/collections/${collection}/forks`, {
			label: "eve",
			workspaceId: own,
			environmentIds: [stray.id],
		});
		// Eve cannot open Ada's personal environment, so it does not exist for her.
		expect(res.status).toBe(404);
		expect(await ForkModel.countDocuments()).toBe(0);
	});

	it("rejects an environment from another workspace of the caller", async () => {
		const { collection } = await setup();
		const own = (await personalWorkspace(ADA)).toHexString();
		const other = await createEnvironmentAs(ADA, own, { name: "Local" });
		const res = await as(ADA).send("post", `/collections/${collection}/forks`, {
			label: "ada",
			workspaceId: own,
			environmentIds: [other.id],
		});
		expect(res.status).toBe(400);
		expect(res.body).toMatchObject({
			error: { code: "FORK_ENVIRONMENT_OUTSIDE_WORKSPACE" },
		});
		expect(await ForkModel.countDocuments()).toBe(0);
	});

	it("checks each environment with the caller's own role on it", async () => {
		const { collection, env } = await setup();
		// A second team where Vic adds elements.
		const vicTeam = (
			await teamWorkspace({ [VIC]: "admin" }, "Vic's team")
		).toHexString();
		// Vic edits the collection (shared to him) but only views the environment.
		await ElementRoleModel.create({
			elementType: "collection",
			elementId: collection,
			userId: VIC,
			role: "editor",
			grantedBy: ADA,
		});
		const res = await as(VIC).send("post", `/collections/${collection}/forks`, {
			label: "vic",
			workspaceId: vicTeam,
			environmentIds: [env],
		});
		expect(res.status).toBe(403);
		expect(res.body).toMatchObject({
			error: { code: "FORK_TARGET_NOT_ALLOWED" },
		});
		expect(await ForkModel.countDocuments()).toBe(0);
		const own = (await personalWorkspace(VIC)).toHexString();
		const ok = await as(VIC).send("post", `/collections/${collection}/forks`, {
			label: "vic",
			workspaceId: own,
			environmentIds: [env],
		});
		expect(ok.status, JSON.stringify(ok.body)).toBe(201);
		const [copy] = await environmentsOf(VIC, own);
		const detail = (await as(VIC).get(`/environments/${copy?.id}`))
			.body as EnvironmentDetail;
		const token = detail.variables.find((v) => v.key === "token");
		// A Viewer of the environment does not take its secret's value along.
		expect(token?.sharedValue ?? null).toBeNull();
	});

	it("leaves nothing behind when the target runs out of environment room", async () => {
		const { ws, collection, env } = await setup();
		const own = await personalWorkspace(EVE);
		await EnvironmentModel.insertMany(
			Array.from({ length: ENVIRONMENTS_PER_WORKSPACE_MAX - 1 }, (_, i) => ({
				workspaceId: own,
				name: `Filler ${i}`,
				color: "grey",
				variables: [],
				createdBy: EVE,
				updatedBy: EVE,
			})),
		);
		const second = await createEnvironmentAs(ADA, ws, { name: "Prod" });
		const res = await as(EVE).send("post", `/collections/${collection}/forks`, {
			label: "eve",
			workspaceId: own.toHexString(),
			environmentIds: [env, second.id],
		});
		expect(res.status).toBe(409);
		expect(res.body).toMatchObject({
			error: { code: "ENVIRONMENT_LIMIT_REACHED" },
		});
		expect(await ForkModel.countDocuments()).toBe(0);
		expect(await EnvironmentModel.countDocuments({ workspaceId: own })).toBe(
			ENVIRONMENTS_PER_WORKSPACE_MAX - 1,
		);
		const collections = await as(EVE).get(
			`/workspaces/${own.toHexString()}/collections`,
		);
		expect(collections.body.items).toHaveLength(0);
	});

	it("takes each environment's fork slot before creating anything", async () => {
		const { collection, env } = await setup();
		const own = (await personalWorkspace(EVE)).toHexString();
		// 10 forks per minute per account; the collection and its environment need two.
		for (let i = 0; i < 9; i++) {
			const res = await as(EVE).send("post", `/environments/${env}/forks`, {
				label: `e${i}`,
				workspaceId: own,
			});
			expect(res.status, JSON.stringify(res.body)).toBe(201);
		}
		const res = await as(EVE).send("post", `/collections/${collection}/forks`, {
			label: "eve",
			workspaceId: own,
			environmentIds: [env],
		});
		expect(res.status).toBe(429);
		expect(await ForkModel.countDocuments({ kind: "collection" })).toBe(0);
	});
});
