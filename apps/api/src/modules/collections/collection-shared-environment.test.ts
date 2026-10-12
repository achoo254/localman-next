import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	DEFAULT_RUNTIME_SETTINGS,
	configureRuntime,
} from "../../config/runtime-settings.js";
import { createLogger } from "../../logger.js";
import { as } from "../../test-support/dashboard-test-app.js";
import { configureShareLogger } from "../access/share-service.js";
import {
	ADA,
	OLLIE,
	notificationsOf,
} from "../access/testing/access-fixture.js";
import { registerEnvironmentAdapter } from "../environments/environment-access.js";
import {
	createEnvironmentAs,
	testKeyring,
	useVariableKeyring,
} from "../environments/testing/environment-fixture.js";
import { CollectionModel } from "./collection-model.js";
import {
	createAs,
	teamOfThree,
	useCollectionTestDb,
} from "./testing/collection-fixture.js";

useCollectionTestDb();
const logger = createLogger("silent");
beforeEach(() => {
	registerEnvironmentAdapter();
	useVariableKeyring(testKeyring());
	configureShareLogger(logger);
});
afterEach(() => {
	vi.restoreAllMocks();
	configureShareLogger(createLogger("silent"));
	configureRuntime(DEFAULT_RUNTIME_SETTINGS);
});

describe("sharing a collection with its environment", () => {
	it("still shares and notifies when linking the environment fails", async () => {
		const ws = (await teamOfThree()).toHexString();
		const { id } = await createAs(ADA, ws, { name: "Orders" });
		const staging = await createEnvironmentAs(ADA, ws, { name: "Staging" });
		const warn = vi.spyOn(logger, "warn");
		vi.spyOn(CollectionModel, "updateOne").mockRejectedValueOnce(
			new Error("database down"),
		);
		const shared = await as(ADA).send(
			"post",
			`/elements/collection/${id}/shares`,
			{
				usernameOrEmail: "ollie",
				role: "viewer",
				includeEnvironmentId: staging.id,
			},
		);
		expect(shared.status, JSON.stringify(shared.body)).toBe(200);
		expect(warn).toHaveBeenCalledTimes(1);
		const types = (await notificationsOf(OLLIE)).map(
			(n) => n.params.elementType,
		);
		expect(types.sort()).toEqual(["collection", "environment"]);
		// Both roles were granted; only the link is missing.
		expect((await as(OLLIE).get(`/collections/${id}`)).body).toMatchObject({
			relatedEnvironment: null,
		});
		expect((await as(OLLIE).get(`/environments/${staging.id}`)).status).toBe(
			200,
		);
	});
});
