import request from "supertest";
import { describe, expect, it } from "vitest";
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
				{
					type: "usage.quota",
					label: expect.any(String),
					inApp: true,
					webPush: false,
					telegram: false,
				},
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
