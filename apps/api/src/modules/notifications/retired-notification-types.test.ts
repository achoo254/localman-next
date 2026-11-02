import { describe, expect, it } from "vitest";
import { storeInAppNotification } from "./channels/in-app-channel.js";
import { NotificationModel } from "./notification-model.js";
import {
	ALICE,
	as,
	useOperationsFixture,
} from "./testing/operations-fixture.js";

useOperationsFixture();

describe("notifications of retired types", () => {
	it("stay stored but are neither listed nor counted as unread", async () => {
		await storeInAppNotification(
			ALICE,
			{ type: "project.mockUrlChanged", params: { project: "Demo" } },
			"en",
		);
		// A Pro trial reminder sent before plans were removed. `lean` skips
		// validation, as the type is no longer in the schema's enum.
		await NotificationModel.insertMany(
			[
				{
					userSub: ALICE,
					type: "trial.ending",
					params: { daysLeft: 3, endsOn: "2026-11-05" },
				},
			],
			{ lean: true },
		);
		expect(await NotificationModel.countDocuments({ userSub: ALICE })).toBe(2);
		const list = await as(ALICE).get("/notifications");
		expect(list.status).toBe(200);
		expect(list.body.items.map((item: { type: string }) => item.type)).toEqual([
			"project.mockUrlChanged",
		]);
		expect(list.body.unreadCount).toBe(1);
	});
});
