import { describe, expect, it } from "vitest";
import { PushSubscriptionModel } from "./push-subscription-model.js";
import {
	ALICE,
	BOB,
	as,
	useChannels,
	useOperationsFixture,
} from "./testing/operations-fixture.js";

const SUBSCRIPTION = {
	endpoint: "https://fcm.googleapis.com/fcm/send/device-1",
	expirationTime: null,
	keys: { p256dh: "B".repeat(87), auth: "a".repeat(22) },
};

useOperationsFixture();

describe("push subscription operations", () => {
	it("register and remove push subscriptions per device", async () => {
		expect((await as(ALICE).get("/push/vapid-public-key")).body).toEqual({
			publicKey: null,
		});
		expect(
			(await as(ALICE).send("post", "/push-subscriptions", SUBSCRIPTION))
				.status,
		).toBe(409);

		useChannels(true);
		expect((await as(ALICE).get("/push/vapid-public-key")).body).toEqual({
			publicKey: "BPublicKey",
		});
		const created = await as(ALICE).send(
			"post",
			"/push-subscriptions",
			SUBSCRIPTION,
		);
		expect(created.status).toBe(201);
		const again = await as(BOB).send(
			"post",
			"/push-subscriptions",
			SUBSCRIPTION,
		);
		expect(again.status).toBe(201);
		const stored = await PushSubscriptionModel.find().lean();
		expect(stored.map((s) => s.userSub)).toEqual([BOB]);
		const prefs = await as(BOB).get("/notification-preferences");
		expect(prefs.body.channels.webPush).toEqual({
			available: true,
			enabled: true,
		});

		const removedByOther = await as(ALICE).send(
			"delete",
			"/push-subscriptions",
			{
				endpoint: SUBSCRIPTION.endpoint,
			},
		);
		expect(removedByOther.body).toEqual({ removed: false });
		const removed = await as(BOB).send("delete", "/push-subscriptions", {
			endpoint: SUBSCRIPTION.endpoint,
		});
		expect(removed.body).toEqual({ removed: true });
	});

	it("only accept browser push service endpoints", async () => {
		useChannels(true);
		for (const endpoint of [
			"http://fcm.googleapis.com/fcm/send/x",
			"https://169.254.169.254/latest",
			"https://evil.example/fcm.googleapis.com",
			"https://fcm.googleapis.com.evil.example/x",
		]) {
			const res = await as(ALICE).send("post", "/push-subscriptions", {
				...SUBSCRIPTION,
				endpoint,
			});
			expect(res.status).toBe(400);
		}
	});
});
