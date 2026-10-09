import { FREE_LIMITS, MAX_RECORDS_PER_RESOURCE } from "@localman/shared";
import { describe, expect, it } from "vitest";
import {
	UsageCounterModel,
	readUsage,
	yyyymmOf,
} from "../billing/usage-counter-model.js";
import { ResourceModel } from "../resources/resource-model.js";
import {
	createResource,
	generate,
} from "../resources/testing/resource-fixture.js";
import { UserModel } from "../users/user-model.js";
import { clearMockProjectCache } from "./resolve-project.js";
import {
	OWNER,
	createMockProject,
	useMockTestKit,
} from "./testing/mock-test-kit.js";

const kit = useMockTestKit();

async function projectWithUsers() {
	const project = await createMockProject();
	const users = await createResource(OWNER, project.id, { name: "users" });
	await generate(OWNER, project.id, users.id, 2);
	return { project, users };
}

async function setUsed(mockRequests: number): Promise<void> {
	await UsageCounterModel.create({
		ownerSub: OWNER,
		yyyymm: yyyymmOf(new Date()),
		mockRequests,
	});
}

/** Sequential requests; far more than a limit, so one window overflows. */
async function statuses(
	send: () => Promise<{ status: number }>,
	count: number,
) {
	const seen: number[] = [];
	for (let i = 0; i < count; i += 1) seen.push((await send()).status);
	return seen;
}

describe("rate limits", () => {
	it("answers 429 with Retry-After past the per-IP limit", async () => {
		const { project } = await projectWithUsers();
		const mock = kit.client(project.secret, {
			limits: { perSecret: 1000, perIp: 2 },
		});
		const responses = [];
		for (let i = 0; i < 8; i += 1) responses.push(await mock.get("/users"));
		const limited = responses.find((res) => res.status === 429);
		expect(limited?.body.error.code).toBe("RATE_LIMITED");
		expect(Number(limited?.headers["retry-after"])).toBeGreaterThanOrEqual(1);
		expect(limited?.headers["access-control-allow-origin"]).toBe("*");
		// Another address keeps its own budget.
		const other = await mock.get("/users").set("x-forwarded-for", "192.0.2.50");
		expect(other.status).toBe(200);
	});

	it("limits a secret across IPs and groups IPv6 by /64", async () => {
		const { project } = await projectWithUsers();
		const perSecret = kit.client(project.secret, {
			limits: { perSecret: 2, perIp: 1000 },
		});
		let ip = 0;
		const acrossIps = await statuses(
			() =>
				perSecret.get("/users").set("x-forwarded-for", `198.51.100.${++ip}`),
			8,
		);
		expect(acrossIps).toContain(429);
		const perIp = kit.client(project.secret, {
			limits: { perSecret: 1000, perIp: 2 },
		});
		let host = 0;
		const sameV6Prefix = await statuses(
			() =>
				perIp.get("/users").set("x-forwarded-for", `2001:db8:1:2::${++host}`),
			8,
		);
		expect(sameV6Prefix).toContain(429);
	});
});

describe("monthly quota", () => {
	it("counts requests, flushes them and refuses past the Free quota", async () => {
		const { project } = await projectWithUsers();
		const quota = FREE_LIMITS.mockRequestsPerMonth ?? 0;
		await setUsed(quota - 2);
		const mock = kit.client(project.secret);
		expect((await mock.get("/users")).status).toBe(200);
		expect((await mock.get("/nope")).status).toBe(404);
		const over = await mock.get("/users");
		expect(over.status).toBe(429);
		expect(over.body).toEqual({
			error: {
				code: "MONTHLY_QUOTA_EXCEEDED",
				message: expect.any(String),
			},
		});
		await kit.meter().flush();
		expect((await readUsage(OWNER)).mockRequests).toBe(quota);
		expect(kit.warn).toHaveBeenCalledTimes(1);
		expect(kit.warn.mock.calls[0]?.[1]).toMatchObject({
			threshold: 100,
			limit: quota,
		});
		// Refused requests are not counted, so no second warning.
		await kit.meter().flush();
		expect((await readUsage(OWNER)).mockRequests).toBe(quota);
		expect(kit.warn).toHaveBeenCalledTimes(1);
	});

	it("warns once at 80% and lifts the cap for a current Pro plan", async () => {
		const { project } = await projectWithUsers();
		const quota = FREE_LIMITS.mockRequestsPerMonth ?? 0;
		await setUsed(Math.ceil(quota * 0.8) - 1);
		const mock = kit.client(project.secret);
		await mock.get("/users");
		await mock.get("/users");
		await kit.meter().flush();
		await mock.get("/users");
		await kit.meter().flush();
		expect(kit.warn).toHaveBeenCalledTimes(1);
		expect(kit.warn.mock.calls[0]?.[1]).toMatchObject({ threshold: 80 });

		await UsageCounterModel.updateOne(
			{ ownerSub: OWNER },
			{ $set: { mockRequests: quota } },
		);
		await UserModel.updateOne(
			{ sub: OWNER },
			{
				$set: { plan: "pro", planExpiresAt: new Date(Date.now() + 86_400_000) },
			},
		);
		clearMockProjectCache();
		const proMock = kit.client(project.secret);
		expect((await proMock.get("/users")).status).toBe(200);
	});
});

describe("record caps", () => {
	it("refuses POST at MAX_RECORDS_PER_RESOURCE and oversized records", async () => {
		const { project, users } = await projectWithUsers();
		const mock = kit.client(project.secret);
		const tooBig = await mock.call("post", "/users", {
			blob: "x".repeat(40 * 1024),
		});
		expect(tooBig.status).toBe(413);
		expect(tooBig.body.error.code).toBe("DATA_TOO_LARGE");
		expect(
			(await mock.call("put", "/users/1", { blob: "x".repeat(40 * 1024) }))
				.status,
		).toBe(413);
		const bodyTooBig = await mock.call("post", "/users", {
			blob: "x".repeat(101 * 1024),
		});
		expect(bodyTooBig.status).toBe(413);
		expect(bodyTooBig.body.error.code).toBe("PAYLOAD_TOO_LARGE");
		await ResourceModel.updateOne(
			{ _id: users.id },
			{ $set: { count: MAX_RECORDS_PER_RESOURCE } },
		);
		const full = await mock.call("post", "/users", { name: "one more" });
		expect(full.status).toBe(409);
		expect(full.body.error.code).toBe("RECORD_LIMIT_REACHED");
	});
});
