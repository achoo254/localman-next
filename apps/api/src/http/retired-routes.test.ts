import { describe, expect, it } from "vitest";
import {
	as,
	guest,
	useDashboardTestDb,
} from "../test-support/dashboard-test-app.js";

useDashboardTestDb(() => ({ ownerSubs: new Set(["acc_owner"]) }));

describe("routes of removed features", () => {
	it.each([
		["post", "/users/me/trial"],
		["post", "/users/me/trial/extension"],
		["get", "/admin/trial-extensions"],
		["post", "/admin/trial-extensions/abc/approve"],
		["post", "/admin/users/acc_x/extend-trial"],
		["post", "/feedback/pro-interest"],
		["get", "/admin/pro-interest"],
		["get", "/admin/pro-interest/export"],
		["delete", "/admin/pro-interest/abc"],
	] as const)("answer 410 GONE to %s %s", async (method, path) => {
		const caller = as("acc_owner");
		const res =
			method === "get"
				? await caller.get(path)
				: await caller.send(method, path);
		expect(res.status).toBe(410);
		expect(res.body.error.code).toBe("GONE");
		expect(res.headers["cache-control"]).toBe("no-store");
	});

	it("keeps the old Turnstile config path working for shipped clients", async () => {
		const current = await guest().get("/feedback/config");
		const legacy = await guest().get("/feedback/pro-interest/config");
		expect(current.status).toBe(200);
		expect(legacy.status).toBe(200);
		expect(legacy.body).toEqual(current.body);
		expect(current.body).toHaveProperty("turnstileSiteKey");
	});

	it("leaves unknown paths to the router's 404", async () => {
		expect((await as("acc_owner").get("/admin/nothing-here")).status).toBe(404);
	});
});
