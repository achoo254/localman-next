import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { captureLogs } from "../../test-support/log-capture.js";
import { UserModel } from "../users/user-model.js";
import {
	DAY_MS,
	OWNER,
	USER,
	ask,
	askPending,
	endsAt,
	useTrialFixture,
} from "./testing/trial-fixture.js";
import { TrialExtensionModel } from "./trial-extension-model.js";
import { configureTrialLogger } from "./trial-plan.js";

const fx = useTrialFixture();

describe("POST /users/me/trial/extension", () => {
	it("stores one pending request and tells the owner without the reason", async () => {
		const none = await ask();
		expect(none.status).toBe(409);
		expect(none.body.error.code).toBe("TRIAL_NOT_EXTENDABLE");

		await as(USER).send("post", "/users/me/trial");
		const res = await ask();
		expect(res.status).toBe(201);
		expect(res.body.trial.extensionRequest).toMatchObject({
			status: "pending",
			decidedAt: null,
		});
		const stored = await TrialExtensionModel.findOne().lean();
		expect(stored?.reason).toBe("Still building the demo for my client");

		const twice = await ask("again");
		expect(twice.status).toBe(409);
		expect(twice.body.error.code).toBe("EXTENSION_PENDING");
		expect((await ask("   ")).status).toBe(400);
		expect((await ask("x".repeat(501))).status).toBe(400);

		expect(await fx.notificationTypes(OWNER)).toEqual([
			"trial.extension.requested",
		]);
		const alerts = await fx.ownerAlerts();
		expect(alerts).toHaveLength(1);
		expect(alerts[0]).toContain("Lan Learner");
		expect(alerts.join("\n")).not.toContain("demo for my client");
	});

	it("is refused more than 7 days after the trial ended", async () => {
		await as(USER).send("post", "/users/me/trial");
		const ended = (days: number) =>
			UserModel.updateOne(
				{ sub: USER },
				{ $set: { planExpiresAt: new Date(Date.now() - days * DAY_MS) } },
			);
		await ended(8);
		expect((await ask()).body.error.code).toBe("TRIAL_NOT_EXTENDABLE");
		await ended(6);
		expect((await ask()).status).toBe(201);
	});
});

describe("owner decisions", () => {
	it("approves: Pro 30 more days from the current end, user notified", async () => {
		const logs = captureLogs();
		configureTrialLogger(logs.logger);
		const id = await askPending();
		const before = await endsAt();
		const res = await as(OWNER).send(
			"post",
			`/admin/trial-extensions/${id}/approve`,
		);
		expect(res.status).toBe(200);
		expect(res.body).toMatchObject({
			id,
			status: "approved",
			reason: "Still building the demo for my client",
			user: { sub: USER, username: "learner", name: "Lan Learner" },
		});
		const after = await endsAt();
		expect(after?.getTime()).toBe((before?.getTime() ?? 0) + 30 * DAY_MS);
		expect(res.body.trialEndsAt).toBe(after?.toISOString());
		const me = (await as(USER).get("/users/me")).body;
		expect(me.plan).toBe("pro");
		expect(me.trial.extensionRequest.status).toBe("approved");
		expect(me.trial.extensionRequest.decidedAt).not.toBeNull();
		expect(await fx.notificationTypes(USER)).toEqual([
			"trial.extension.approved",
		]);
		expect(logs.entries("Trial extension requested")).toHaveLength(1);
		expect(logs.entries("Trial extension approved")[0]).toMatchObject({
			requestId: id,
			sub: USER,
			by: OWNER,
		});
		expect(logs.lines.join("")).not.toContain("demo for my client");

		const again = await as(OWNER).send(
			"post",
			`/admin/trial-extensions/${id}/decline`,
		);
		expect(again.status).toBe(409);
		expect(again.body.error.code).toBe("EXTENSION_DECIDED");
	});

	it("approves an ended trial from now", async () => {
		const id = await askPending();
		await UserModel.updateOne(
			{ sub: USER },
			{ $set: { planExpiresAt: new Date(Date.now() - 2 * DAY_MS) } },
		);
		await as(OWNER).send("post", `/admin/trial-extensions/${id}/approve`);
		const days = ((await endsAt())?.getTime() ?? 0) - Date.now();
		expect(days / DAY_MS).toBeGreaterThan(29.9);
		expect(days / DAY_MS).toBeLessThan(31);
		expect((await as(USER).get("/users/me")).body.plan).toBe("pro");
	});

	it("declines: the end stays, the user is notified and may ask again", async () => {
		const id = await askPending();
		const before = await endsAt();
		const res = await as(OWNER).send(
			"post",
			`/admin/trial-extensions/${id}/decline`,
		);
		expect(res.status).toBe(200);
		expect(res.body.status).toBe("declined");
		expect(await endsAt()).toEqual(before);
		expect(await fx.notificationTypes(USER)).toEqual([
			"trial.extension.declined",
		]);
		expect((await ask("one more time")).status).toBe(201);
	});
});
