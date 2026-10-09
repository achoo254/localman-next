import { expect } from "vitest";
import { as } from "../../../test-support/dashboard-test-app.js";
import { resourcesPath } from "./resource-fixture.js";

/** TEST ONLY. `POST …/resources/import` as `sub`, a preview when `dryRun`. */
export function importAs(
	sub: string,
	projectId: string,
	body: object,
	dryRun = false,
) {
	const suffix = `/import${dryRun ? "?dryRun=true" : ""}`;
	return as(sub).send("post", resourcesPath(projectId, suffix), body);
}

/** TEST ONLY. The stored records of a resource. */
export async function dataOf(
	sub: string,
	projectId: string,
	resourceId: string,
): Promise<Record<string, unknown>[]> {
	const res = await as(sub).get(
		resourcesPath(projectId, `/${resourceId}/data`),
	);
	expect(res.status).toBe(200);
	return res.body.data as Record<string, unknown>[];
}
