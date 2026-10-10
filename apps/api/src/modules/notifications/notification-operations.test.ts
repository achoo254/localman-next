import request from "supertest";
import { describe, expect, it } from "vitest";
import { AccessRequestModel } from "../access/access-request-model.js";
import { UserModel } from "../users/user-model.js";
import { storeInAppNotification } from "./channels/in-app-channel.js";
import {
	ALICE,
	BOB,
	app,
	as,
	useOperationsFixture,
} from "./testing/operations-fixture.js";

const EVENT = {
	type: "project.mockUrlChanged",
	params: { project: "Demo" },
} as const;
const store = (sub: string, project = "Demo") =>
	storeInAppNotification(sub, { ...EVENT, params: { project } }, "en");

useOperationsFixture();

describe("notification operations", () => {
	it("require a session", async () => {
		for (const path of [
			"/notifications",
			"/notification-preferences",
			"/push/vapid-public-key",
		]) {
			expect((await request(app).get(`/api/v1${path}`)).status).toBe(401);
		}
	});

	it("list the user's own notifications, newest first, with a cursor", async () => {
		for (let i = 0; i < 25; i += 1) {
			await store(ALICE, `n${i}`);
		}
		await store(BOB);
		const first = await as(ALICE).get("/notifications?limit=10");
		expect(first.status).toBe(200);
		expect(first.body.items).toHaveLength(10);
		expect(first.body.items[0].body).toContain('"n24"');
		expect(first.body.unreadCount).toBe(25);
		const second = await as(ALICE).get(
			`/notifications?limit=10&cursor=${first.body.nextCursor}`,
		);
		expect(second.body.items[0].body).toContain('"n14"');
		const last = await as(ALICE).get(
			`/notifications?cursor=${second.body.nextCursor}`,
		);
		expect(last.body.items).toHaveLength(5);
		expect(last.body.nextCursor).toBeNull();
		expect((await as(ALICE).get("/notifications?limit=500")).status).toBe(400);
	});

	it("mark one or all as read, never another user's", async () => {
		const mine = await store(ALICE);
		await store(ALICE);
		const theirs = await store(BOB);
		const read = await as(ALICE).send("post", `/notifications/${mine.id}/read`);
		expect(read.status).toBe(200);
		expect(read.body.readAt).toEqual(expect.any(String));
		expect(
			(await as(ALICE).send("post", `/notifications/${theirs.id}/read`)).status,
		).toBe(404);
		expect(
			(await as(ALICE).send("post", "/notifications/not-an-id/read")).status,
		).toBe(404);
		const all = await as(ALICE).send("post", "/notifications/read-all");
		expect(all.body).toEqual({ updatedCount: 1 });
		expect((await as(BOB).get("/notifications")).body.unreadCount).toBe(1);
	});

	it("give access.requested items their request and its status, others null", async () => {
		const request = await AccessRequestModel.create({
			elementType: "collection",
			elementId: "c1",
			requesterId: BOB,
			role: "editor",
			status: "pending",
		});
		const requestId = request._id.toHexString();
		const asked = await storeInAppNotification(
			ALICE,
			{
				type: "access.requested",
				params: {
					requester: "Bob",
					elementType: "collection",
					element: "Orders API",
					role: "editor",
					requestId,
				},
			},
			"en",
		);
		const gone = await storeInAppNotification(
			ALICE,
			{
				type: "access.requested",
				params: {
					requester: "Bob",
					elementType: "collection",
					element: "Old",
					role: "viewer",
					requestId: "0123456789abcdef01234567",
				},
			},
			"en",
		);
		await store(ALICE);
		const list = await as(ALICE).get("/notifications");
		expect(list.status).toBe(200);
		expect(
			list.body.items.map(
				(item: { accessRequest: unknown }) => item.accessRequest,
			),
		).toEqual([
			null,
			null,
			{
				id: requestId,
				status: "pending",
				role: "editor",
				notifiedRole: "editor",
			},
		]);
		await AccessRequestModel.updateOne(
			{ _id: request._id },
			{ $set: { status: "approved" } },
		);
		const read = await as(ALICE).send(
			"post",
			`/notifications/${asked.id}/read`,
		);
		expect(read.body.accessRequest).toEqual({
			id: requestId,
			status: "approved",
			role: "editor",
			notifiedRole: "editor",
		});
		const readGone = await as(ALICE).send(
			"post",
			`/notifications/${gone.id}/read`,
		);
		expect(readGone.body.accessRequest).toBeNull();
	});

	it("read and update per-event channel preferences", async () => {
		const initial = await as(ALICE).get("/notification-preferences");
		expect(initial.body).toEqual({
			channels: {
				webPush: { available: false, enabled: false },
				telegram: {
					available: false,
					linked: false,
					activated: false,
					botUsername: null,
				},
			},
			events: [
				{
					type: "project.invitation",
					label: expect.any(String),
					inApp: true,
					webPush: false,
					telegram: false,
				},
				{
					type: "project.mockUrlChanged",
					label: expect.any(String),
					inApp: true,
					webPush: false,
					telegram: false,
				},
				...[
					"usage.quota",
					"workspace.invitation",
					"element.shared",
					"access.requested",
					"access.resolved",
				].map((type) => ({
					type,
					label: expect.any(String),
					inApp: true,
					webPush: false,
					telegram: false,
				})),
			],
		});
		await UserModel.updateOne(
			{ sub: ALICE },
			{ telegram: { chatId: "1", blockedAt: new Date() } },
		);
		const updated = await as(ALICE).send("put", "/notification-preferences", {
			events: [
				{
					type: "project.invitation",
					inApp: false,
					webPush: true,
					telegram: true,
				},
			],
		});
		expect(updated.status).toBe(200);
		expect(updated.body.events[0]).toMatchObject({
			inApp: false,
			webPush: true,
			telegram: true,
		});
		expect(updated.body.channels.telegram).toMatchObject({
			linked: true,
			activated: true,
		});
		const bad = await as(ALICE).send("put", "/notification-preferences", {
			events: [{ type: "unknown.event", webPush: true }],
		});
		expect(bad.status).toBe(400);
	});
});
