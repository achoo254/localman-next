import { describe, expect, it } from "vitest";
import { clientIpBucket } from "../../lib/rate-limit-windows.js";
import { runInTenant } from "../../tenancy/tenant-context.js";
import { as, guest } from "../../test-support/dashboard-test-app.js";
import { startClearOfRateWindowEdge } from "../../test-support/rate-window-edge.js";
import { TEST_TENANT } from "../../test-support/test-tenant.js";
import { assertHumanGuest } from "./feedback-guards.js";
import { FeedbackModel } from "./feedback-model.js";
import { alertOwnerThrottled } from "./owner-alert-throttle.js";
import { TURNSTILE_TOKENS } from "./testing/fake-turnstile.js";
import {
	FORM,
	SUBMIT,
	useProInterestFixture,
} from "./testing/pro-interest-fixture.js";

const fx = useProInterestFixture(() => ({
	feedbackRateLimit: {
		perIp: { max: 3, windowMs: 60_000 },
		perUser: { max: 2, windowMs: 60_000 },
	},
	ownerAlertLimit: { max: 2, windowMs: 60_000 },
}));

const asGuest = (ip: string, email = FORM.email) =>
	guest(ip).send("post", SUBMIT, {
		...FORM,
		email,
		turnstileToken: TURNSTILE_TOKENS.valid,
	});

describe("clientIpBucket", () => {
	it.each([
		["2001:db8:1:2:aaaa::1", "2001:db8:1:2::/64"],
		["2001:0db8:0001:0002:ffff:ffff:ffff:ffff", "2001:db8:1:2::/64"],
		["fe80::1%eth0", "fe80:0:0:0::/64"],
		["::ffff:203.0.113.5", "203.0.113.5"],
		["64:ff9b::192.0.2.33", "64:ff9b:0:0::/64"],
		["203.0.113.5", "203.0.113.5"],
		[null, "unknown"],
	])("%s is counted as %s", (ip, bucket) => {
		expect(clientIpBucket(ip)).toBe(bucket);
	});
});

describe("Pro interest limits", () => {
	it("rate-limits per IPv4 address", async () => {
		await startClearOfRateWindowEdge(60_000);
		for (let i = 0; i < 3; i += 1)
			expect((await asGuest("203.0.113.7")).status).toBe(201);
		const limited = await asGuest("203.0.113.7");
		expect(limited.status).toBe(429);
		expect(limited.body.error.code).toBe("RATE_LIMITED");
		expect((await asGuest("203.0.113.8")).status).toBe(201);
	});

	it("counts a whole IPv6 /64 as one client", async () => {
		await startClearOfRateWindowEdge(60_000);
		for (let i = 1; i <= 3; i += 1) {
			expect((await asGuest(`2001:db8:5:6::${i}`)).status).toBe(201);
		}
		expect((await asGuest("2001:db8:5:6:ffff::9")).status).toBe(429);
		expect((await asGuest("2001:db8:5:7::1")).status).toBe(201);
	});

	it("limits a signed-in account across networks with its stricter quota", async () => {
		await startClearOfRateWindowEdge(60_000);
		const submit = (ip: string) =>
			as("acc_roaming", ip).send("post", SUBMIT, FORM);
		expect((await submit("198.51.100.30")).status).toBe(201);
		expect((await submit("198.51.100.31")).status).toBe(201);
		expect((await submit("198.51.100.32")).status).toBe(429);
	});

	it("caps owner alerts per window and summarizes the skipped ones later", async () => {
		for (let i = 0; i < 4; i += 1) {
			expect(
				(await asGuest(`198.51.100.${40 + i}`, `p${i}@x.com`)).status,
			).toBe(201);
		}
		expect(await FeedbackModel.countDocuments()).toBe(4);
		expect(await fx.alerts()).toHaveLength(2);
	});

	it("adds the count of skipped alerts to the first alert of the next window", async () => {
		const start = new Date("2026-10-09T03:00:00Z");
		for (let i = 0; i < 5; i += 1)
			await alertOwnerThrottled("test.kind", () => `a${i}`, start);
		const next = new Date(start.getTime() + 60_000);
		await alertOwnerThrottled("test.kind", () => "later", next);
		await alertOwnerThrottled("test.kind", () => "again", next);
		// Background sends may reach the fake Bot API in any order.
		expect((await fx.alerts()).sort()).toEqual(
			[
				"a0",
				"a1",
				"later\n\n(and 3 more not sent because of the alert limit)",
				"again",
			].sort(),
		);
	});

	it("keeps another tenant's entries from the deployment owner and its guests out", async () => {
		const other = { ...TEST_TENANT, id: "ten_AAAAAAAAAAAAAAAA" };
		await runInTenant(other, async () => {
			await alertOwnerThrottled("test.kind", () => "other tenant");
			await expect(
				assertHumanGuest(
					{ userSub: null, clientIp: null },
					undefined,
					"pro_interest",
				),
			).rejects.toMatchObject({ status: 401 });
		});
		expect(await fx.alerts()).toEqual([]);
	});
});
