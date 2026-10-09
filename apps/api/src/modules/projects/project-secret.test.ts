import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import {
	BOB,
	DAVE,
	OWNER,
	addMember,
	createProject,
	useCollaboratorTestDb,
} from "../collaborators/testing/collaborator-fixture.js";
import { resolveProject } from "../mock-runtime/resolve-project.js";
import { NotificationModel } from "../notifications/notification-model.js";
import { getNotificationService } from "../notifications/notification-runtime.js";

useCollaboratorTestDb(() => ({ mockBaseDomain: "mock.test" }));

const rotatePath = (projectId: string) =>
	`/projects/${projectId}/rotate-secret`;

describe("POST /projects/:projectId/rotate-secret", () => {
	it("previews with dryRun how many collaborators would be told", async () => {
		const projectId = await createProject(OWNER);
		await addMember(OWNER, projectId, BOB, "bob");
		const before = await as(OWNER).get(`/projects/${projectId}`);
		const dry = await as(OWNER).send(
			"post",
			`${rotatePath(projectId)}?dryRun=true`,
		);
		expect(dry.status).toBe(200);
		expect(dry.body).toMatchObject({ dryRun: true, collaborators: 1 });
		expect(dry.body.project.secret).toBe(before.body.secret);
	});

	it("cuts off the old mock URL at once and tells the remaining collaborators", async () => {
		const projectId = await createProject(OWNER);
		await addMember(OWNER, projectId, BOB, "bob");
		await addMember(OWNER, projectId, DAVE, "dave");
		const oldSecret = (await as(OWNER).get(`/projects/${projectId}`)).body
			.secret;
		// Warm the mock runtime's cache with the old secret.
		expect(await resolveProject(oldSecret)).not.toBeNull();

		// The owner removes DAVE, who still knows the URL, then rotates.
		const list = await as(OWNER).get(`/projects/${projectId}/collaborators`);
		const daveRow = list.body.items.find(
			(item: { user: { sub: string } }) => item.user.sub === DAVE,
		);
		await as(OWNER).send(
			"delete",
			`/projects/${projectId}/collaborators/${daveRow.id}`,
		);
		const res = await as(OWNER).send("post", rotatePath(projectId));
		expect(res.status).toBe(200);
		expect(res.body.dryRun).toBe(false);
		expect(res.body.collaborators).toBe(1);
		const { secret, mockBaseUrl } = res.body.project;
		expect(secret).not.toBe(oldSecret);
		expect(secret).toMatch(/^[a-z0-9]{24}$/);
		expect(mockBaseUrl).toBe(`https://${secret}.mock.test`);
		expect(await resolveProject(oldSecret)).toBeNull();
		expect((await resolveProject(secret))?.id.toHexString()).toBe(projectId);

		await getNotificationService().drain();
		const told = await NotificationModel.find({
			type: "project.mockUrlChanged",
		}).lean();
		expect(told.map((n) => n.userSub)).toEqual([BOB]);
		expect(told[0]?.link).toBe(`/projects/${projectId}`);
	});

	it("is owner-only", async () => {
		const projectId = await createProject(OWNER);
		await addMember(OWNER, projectId, BOB, "bob");
		expect((await as(BOB).send("post", rotatePath(projectId))).status).toBe(
			403,
		);
		expect((await as(DAVE).send("post", rotatePath(projectId))).status).toBe(
			404,
		);
	});
});
