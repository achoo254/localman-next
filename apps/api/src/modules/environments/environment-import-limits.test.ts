import {
	ENVIRONMENT_VARIABLES_MAX,
	VARIABLE_KEY_MAX,
	VARIABLE_VALUE_MAX,
} from "@localman/shared/api-client";
import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { EVE } from "../access/testing/access-fixture.js";
import { teamOfThree } from "../collections/testing/collection-fixture.js";
import { IMPORT_BODY_LIMIT } from "./environment-transfer-operations.js";
import { useEnvironmentTestDb } from "./testing/environment-fixture.js";

useEnvironmentTestDb();

/** Every variable at its longest key and value, 3 bytes per character. */
function largestFile() {
	return {
		name: "Largest",
		values: Array.from({ length: ENVIRONMENT_VARIABLES_MAX }, (_, i) => ({
			key: `${i}`.padStart(VARIABLE_KEY_MAX, "k"),
			value: "ệ".repeat(VARIABLE_VALUE_MAX),
			type: "default",
			enabled: true,
		})),
	};
}

const importAs = (sub: string, ws: string, body: object) =>
	as(sub).send("post", `/workspaces/${ws}/environments/import`, body);

describe("environment import body limit", () => {
	it("takes the largest valid file", async () => {
		const ws = (await teamOfThree()).toHexString();
		const body = { environment: largestFile() };
		const bytes = Buffer.byteLength(JSON.stringify(body));
		// Over the 3 MiB other variable writes allow.
		expect(bytes).toBeGreaterThan(3 * 1024 * 1024);
		expect(bytes).toBeLessThan(IMPORT_BODY_LIMIT);
		const res = await importAs(EVE, ws, body);
		expect(res.status, JSON.stringify(res.body).slice(0, 300)).toBe(201);
		expect(res.body.variables).toHaveLength(ENVIRONMENT_VARIABLES_MAX);
	});

	it("answers 413 above the limit", async () => {
		const ws = (await teamOfThree()).toHexString();
		const padding = "x".repeat(IMPORT_BODY_LIMIT);
		const res = await importAs(EVE, ws, {
			environment: { name: "Too big", values: [], padding },
		});
		expect(res.status).toBe(413);
		expect(res.body.error.code).toBe("PAYLOAD_TOO_LARGE");
	});
});
