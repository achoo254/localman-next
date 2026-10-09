import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { createLogger } from "../../logger.js";
import {
	clearCollections,
	connectTestMongo,
} from "../../test-support/test-mongo.js";
import { readUsage } from "../billing/usage-counter-model.js";
import { quotaWarningMessage } from "./quota-warnings.js";
import { UsageMeter } from "./usage-meter.js";

const OWNER = "acc_meter_owner";
let teardown: (() => Promise<void>) | undefined;
beforeAll(async () => {
	teardown = await connectTestMongo();
});
afterAll(async () => {
	await teardown?.();
});
beforeEach(clearCollections);

describe("UsageMeter", () => {
	it("keeps months apart (Asia/Saigon) and writes pending counts on stop", async () => {
		// 2026-10-31 23:59 in Saigon, then a minute later (November).
		let now = new Date("2026-10-31T16:59:00Z");
		const warn = vi.fn(async () => {});
		const meter = new UsageMeter({
			logger: createLogger("silent"),
			warn,
			now: () => now,
		});
		meter.start(60_000);
		expect(await meter.admit(OWNER, 2)).toBe(true);
		expect(await meter.admit(OWNER, 2)).toBe(true);
		expect(await meter.admit(OWNER, 2)).toBe(false);
		now = new Date("2026-10-31T17:00:00Z");
		expect(await meter.admit(OWNER, 2)).toBe(true);
		await meter.stop();
		const october = await readUsage(OWNER, new Date("2026-10-15T00:00:00Z"));
		const november = await readUsage(OWNER, new Date("2026-11-15T00:00:00Z"));
		expect(october.mockRequests).toBe(2);
		expect(november.mockRequests).toBe(1);
		// October crossed 80% (2 of 2 ≥ 1.6) and 100% in one flush.
		expect(warn).toHaveBeenCalledTimes(2);
	});

	it("counts without a cap for unlimited plans and shares one flush", async () => {
		const meter = new UsageMeter({
			logger: createLogger("silent"),
			warn: async () => {},
		});
		const admitted = await Promise.all(
			Array.from({ length: 50 }, () => meter.admit(OWNER, null)),
		);
		expect(admitted.every(Boolean)).toBe(true);
		await Promise.all([meter.flush(), meter.flush()]);
		expect((await readUsage(OWNER)).mockRequests).toBe(50);
	});

	it("writes counts added during a running flush when stopping", async () => {
		const meter = new UsageMeter({
			logger: createLogger("silent"),
			warn: async () => {},
		});
		await meter.admit(OWNER, null);
		const running = meter.flush();
		await meter.admit(OWNER, null);
		await meter.admit(OWNER, null);
		// Calls during the run share one follow-up flush.
		const again = meter.flush();
		expect(meter.flush()).toBe(again);
		await meter.stop();
		await running;
		expect((await readUsage(OWNER)).mockRequests).toBe(3);
	});

	it("keeps counting an owner whose idle entry was dropped", async () => {
		let now = new Date("2026-10-10T03:00:00Z");
		const meter = new UsageMeter({
			logger: createLogger("silent"),
			warn: async () => {},
			now: () => now,
		});
		await meter.admit(OWNER, 5);
		await meter.flush();
		now = new Date(now.getTime() + 11 * 60_000);
		// The admit waits for nothing (entry still loaded) while the flush
		// drops the idle entry; the count must survive.
		const admitted = meter.admit(OWNER, 5);
		await meter.flush();
		expect(await admitted).toBe(true);
		await meter.admit(OWNER, 5);
		await meter.flush();
		expect((await readUsage(OWNER, now)).mockRequests).toBe(3);
	});

	it("words the warnings for the account page", () => {
		const warning = quotaWarningMessage({
			threshold: 80,
			limit: 10_000,
			month: "202610",
		});
		expect(warning).toMatchObject({ type: "usage.quota", link: "/account" });
		expect(warning.body).toContain("8.000/10.000");
		expect(warning.body).toContain("10/2026");
	});
});
