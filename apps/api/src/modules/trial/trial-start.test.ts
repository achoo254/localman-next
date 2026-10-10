import { limitsFor } from "@localman/shared";
import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { ProjectModel } from "../projects/project-model.js";
import { UserModel } from "../users/user-model.js";
import { DAY_MS, USER, useTrialFixture } from "./testing/trial-fixture.js";

useTrialFixture();

const lapse = () =>
	UserModel.updateOne(
		{ sub: USER },
		{ $set: { planExpiresAt: new Date(Date.now() - 60_000) } },
	);

describe("POST /users/me/trial", () => {
	it("starts once: Pro until the end of the Saigon day 30 days later", async () => {
		const before = (await as(USER).get("/users/me")).body;
		expect(before.plan).toBe("free");
		expect(before.trial).toEqual({
			status: "available",
			startedAt: null,
			endsAt: null,
			extensionRequest: null,
		});

		const res = await as(USER).send("post", "/users/me/trial");
		expect(res.status).toBe(200);
		expect(res.body.plan).toBe("pro");
		expect(res.body.trial.status).toBe("active");
		const endsAt = new Date(res.body.trial.endsAt);
		expect(res.body.trial.endsAt).toMatch(/T16:59:59\.999Z$/);
		const days = (endsAt.getTime() - Date.now()) / DAY_MS;
		expect(days).toBeGreaterThan(29.9);
		expect(days).toBeLessThan(31);
		const stored = await UserModel.findOne({ sub: USER }).lean();
		expect(stored?.planExpiresAt?.toISOString()).toBe(res.body.trial.endsAt);

		const again = await as(USER).send("post", "/users/me/trial");
		expect(again.status).toBe(409);
		expect(again.body.error.code).toBe("TRIAL_ALREADY_USED");
	});

	it("starts one trial when clicked twice at once", async () => {
		const results = await Promise.all([
			as(USER).send("post", "/users/me/trial"),
			as(USER).send("post", "/users/me/trial"),
		]);
		const statuses = results.map((res) => res.status).sort();
		expect(statuses).toEqual([200, 409]);
		const refused = results.find((res) => res.status === 409);
		expect(refused?.body.error.code).toBe("TRIAL_ALREADY_USED");
	});

	it("refuses ALREADY_PRO during an owner grant, then allows a trial once it lapses", async () => {
		await UserModel.updateOne({ sub: USER }, { $set: { plan: "pro" } });
		const forever = await as(USER).send("post", "/users/me/trial");
		expect(forever.status).toBe(409);
		expect(forever.body.error.code).toBe("ALREADY_PRO");
		expect((await as(USER).get("/users/me")).body.trial.status).toBe(
			"available",
		);

		await lapse();
		const res = await as(USER).send("post", "/users/me/trial");
		expect(res.status).toBe(200);
		expect(res.body.trial.status).toBe("active");
	});

	it("is Free again everywhere once the trial ends", async () => {
		await as(USER).send("post", "/users/me/trial");
		await lapse();
		const me = (await as(USER).get("/users/me")).body;
		expect(me.plan).toBe("free");
		expect(me.trial.status).toBe("ended");
		const usage = (await as(USER).get("/account/usage")).body;
		expect(usage.plan).toBe("free");
		expect(usage.projects.max).toBe(limitsFor("free").projects);
		const again = await as(USER).send("post", "/users/me/trial");
		expect(again.body.error.code).toBe("TRIAL_ALREADY_USED");
	});
});

describe("after the trial: over the Free limits", () => {
	it("keeps every project, lists the exceeded limit and refuses only creating more", async () => {
		const freeMax = limitsFor("free").projects;
		await as(USER).send("post", "/users/me/trial");
		for (let i = 0; i <= freeMax; i += 1) {
			const created = await as(USER).send("post", "/projects", {
				name: `Project ${i}`,
			});
			expect(created.status).toBe(201);
		}
		const proUsage = (await as(USER).get("/account/usage")).body;
		expect(proUsage.overLimits).toEqual([]);

		await lapse();
		const usage = (await as(USER).get("/account/usage")).body;
		expect(usage.overLimits).toEqual([
			{ limit: "projects", used: freeMax + 1, max: freeMax },
		]);
		const blocked = await as(USER).send("post", "/projects", { name: "More" });
		expect(blocked.status).toBe(403);
		expect(blocked.body.error.code).toBe("PLAN_LIMIT_REACHED");
		expect(blocked.body.error.details).toMatchObject({
			limit: "projects",
			max: freeMax,
		});
		expect(await ProjectModel.countDocuments({ owner: USER })).toBe(
			freeMax + 1,
		);
		const listed = await as(USER).get("/projects");
		expect(listed.status).toBe(200);
	});
});
