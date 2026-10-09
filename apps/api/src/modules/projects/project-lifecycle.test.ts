import { describe, expect, it } from "vitest";
import {
	as,
	useDashboardTestDb,
} from "../../test-support/dashboard-test-app.js";
import { ProjectModel } from "./project-model.js";
import { useProjectFixture } from "./testing/project-fixture.js";

const ALICE = "acc_alice";
const BOB = "acc_bob";

useDashboardTestDb(() => ({ mockBaseDomain: "mock.test" }));
const { stubRows, createAs } = useProjectFixture(ALICE, BOB);

describe("project clone and delete", () => {
	it("clone with a new secret, a (copy) name and the dependents' data", async () => {
		const source = await createAs(ALICE, "Shop");
		stubRows.set(source.id, ["users", "orders"]);
		const res = await as(ALICE).send("post", `/projects/${source.id}/clone`);
		expect(res.status).toBe(201);
		expect(res.body.name).toBe("Shop (copy)");
		expect(res.body.secret).not.toBe(source.secret);
		expect(res.body.id).not.toBe(source.id);
		expect(stubRows.get(res.body.id)).toEqual(["users", "orders"]);
		// The clone is editable as is: its name passes validation.
		const edit = await as(ALICE).send("put", `/projects/${res.body.id}`, {
			name: res.body.name,
		});
		expect(edit.status).toBe(200);
	});

	it("preview a delete with dryRun, then cascade it", async () => {
		const project = await createAs(ALICE);
		stubRows.set(project.id, ["users"]);
		const preview = await as(ALICE).send(
			"delete",
			`/projects/${project.id}?dryRun=true`,
		);
		expect(preview.status).toBe(200);
		expect(preview.body).toMatchObject({
			id: project.id,
			deleted: false,
			dryRun: true,
		});
		// Registration order follows module imports; compare as a set.
		expect(preview.body.dependents).toHaveLength(6);
		expect(preview.body.dependents).toEqual(
			expect.arrayContaining([
				{ kind: "resources", count: 0 },
				{ kind: "records", count: 0 },
				{ kind: "collaborators", count: 0 },
				{ kind: "magicLinks", count: 0 },
				{ kind: "mcpTokens", count: 0 },
				{ kind: "stub-rows", count: 1 },
			]),
		);
		expect(await ProjectModel.countDocuments()).toBe(1);

		const real = await as(ALICE).send("delete", `/projects/${project.id}`);
		expect(real.body).toMatchObject({ deleted: true, dryRun: false });
		expect(await ProjectModel.countDocuments()).toBe(0);
		expect(stubRows.has(project.id)).toBe(false);
	});
});
