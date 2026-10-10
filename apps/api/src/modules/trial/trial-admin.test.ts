import { describe, expect, it } from "vitest";
import { as, guest } from "../../test-support/dashboard-test-app.js";
import { UserModel } from "../users/user-model.js";
import {
	DAY_MS,
	OWNER,
	USER,
	ask,
	askPending,
	useTrialFixture,
} from "./testing/trial-fixture.js";
import { TrialExtensionModel } from "./trial-extension-model.js";

const fx = useTrialFixture();

describe("trial admin", () => {
	it("lists pending or all requests, newest first, with paging", async () => {
		const id = await askPending();
		await as(OWNER).send("post", `/admin/trial-extensions/${id}/decline`);
		await ask("second");
		const pending = (await as(OWNER).get("/admin/trial-extensions")).body;
		expect(pending.items.map((i: { reason: string }) => i.reason)).toEqual([
			"second",
		]);
		expect(pending.nextCursor).toBeNull();
		const all = (await as(OWNER).get("/admin/trial-extensions?status=all"))
			.body;
		expect(all.items.map((i: { status: string }) => i.status)).toEqual([
			"pending",
			"declined",
		]);
		const bad = await as(OWNER).get("/admin/trial-extensions?cursor=nope");
		expect(bad.status).toBe(400);
	});

	it("extends anyone directly by 1-90 days", async () => {
		const res = await as(OWNER).send(
			"post",
			`/admin/users/${USER}/extend-trial`,
			{
				days: 10,
			},
		);
		expect(res.status).toBe(200);
		expect(res.body.plan).toBe("pro");
		const days = (Date.parse(res.body.planExpiresAt) - Date.now()) / DAY_MS;
		expect(days).toBeGreaterThan(9.9);
		expect(days).toBeLessThan(11);
		const more = await as(OWNER).send(
			"post",
			`/admin/users/${USER}/extend-trial`,
			{
				days: 5,
			},
		);
		expect(Date.parse(more.body.planExpiresAt)).toBe(
			Date.parse(res.body.planExpiresAt) + 5 * DAY_MS,
		);
		expect(await fx.notificationTypes(USER)).toEqual([
			"trial.extension.approved",
			"trial.extension.approved",
		]);

		for (const days of [0, 91, 1.5]) {
			const bad = await as(OWNER).send(
				"post",
				`/admin/users/${USER}/extend-trial`,
				{
					days,
				},
			);
			expect(bad.status).toBe(400);
		}
		const missing = await as(OWNER).send(
			"post",
			"/admin/users/nobody/extend-trial",
			{
				days: 3,
			},
		);
		expect(missing.status).toBe(404);
		await UserModel.updateOne({ sub: USER }, { $unset: { planExpiresAt: 1 } });
		const forever = await as(OWNER).send(
			"post",
			`/admin/users/${USER}/extend-trial`,
			{
				days: 3,
			},
		);
		expect(forever.body.error.code).toBe("PLAN_HAS_NO_EXPIRY");
	});

	it("is reserved to owners", async () => {
		const id = await askPending();
		const calls = (who: ReturnType<typeof as>) => [
			who.get("/admin/trial-extensions"),
			who.send("post", `/admin/trial-extensions/${id}/approve`),
			who.send("post", `/admin/trial-extensions/${id}/decline`),
			who.send("post", `/admin/users/${USER}/extend-trial`, { days: 30 }),
		];
		for (const res of await Promise.all(calls(as(USER)))) {
			expect(res.status).toBe(403);
		}
		for (const res of await Promise.all(calls(guest()))) {
			expect(res.status).toBe(401);
		}
		const prefs = (await as(USER).get("/notification-preferences")).body;
		const types = prefs.events.map((e: { type: string }) => e.type);
		expect(types).not.toContain("trial.extension.requested");
		const ownerPrefs = (await as(OWNER).get("/notification-preferences")).body;
		expect(ownerPrefs.events.map((e: { type: string }) => e.type)).toContain(
			"trial.extension.requested",
		);
		expect((await TrialExtensionModel.findById(id).lean())?.status).toBe(
			"pending",
		);
	});
});
