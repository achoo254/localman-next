import {
	type EndpointChaos,
	endpointChaosSchema,
} from "@localman/shared/endpoint-behavior";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DelayGate, sleep } from "./chaos-delay.js";
import {
	CHAOS_RETRY_AFTER_SECONDS,
	DEFAULT_TIMEOUT_HOLD_MS,
	type Rng,
	decideChaos,
	waitOf,
} from "./chaos.js";

/** TEST ONLY. mulberry32: a small seeded PRNG, so every run draws the same. */
function seeded(seed: number): Rng {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
	};
}

const chaos = (input: Partial<EndpointChaos>): EndpointChaos =>
	endpointChaosSchema.parse(input);

const draw = (config: EndpointChaos, times: number, seed = 42) => {
	const rng = seeded(seed);
	return Array.from({ length: times }, () => decideChaos(config, rng));
};

describe("decideChaos", () => {
	it("does nothing without chaos", () => {
		expect(decideChaos(undefined, () => 0)).toEqual({
			latencyMs: 0,
			fault: null,
		});
	});

	it("draws latencies within the range, both ends included", () => {
		const latencies = draw(chaos({ latencyMs: [100, 104] }), 1_000).map(
			(decision) => decision.latencyMs,
		);
		expect(Math.min(...latencies)).toBe(100);
		expect(Math.max(...latencies)).toBe(104);
		expect(new Set(latencies).size).toBe(5);
	});

	it("errors in 45-55% of 1,000 requests at errorRate 0.5", () => {
		for (const seed of [1, 42, 2026]) {
			const config = chaos({ errorRate: 0.5, errorStatus: 503 });
			const faults = draw(config, 1_000, seed).filter((d) => d.fault);
			expect(faults.length).toBeGreaterThanOrEqual(450);
			expect(faults.length).toBeLessThanOrEqual(550);
			expect(faults[0]?.fault).toEqual({ kind: "error", status: 503 });
		}
	});

	it("splits one roll into timeout, 429 and error bands", () => {
		const config = chaos({
			timeoutRate: 0.2,
			rateLimitRate: 0.3,
			errorRate: 0.4,
		});
		const roll = (value: number) => decideChaos(config, () => value).fault;
		expect(roll(0.1)?.kind).toBe("timeout");
		expect(roll(0.25)).toEqual({
			kind: "rateLimit",
			retryAfterSeconds: CHAOS_RETRY_AFTER_SECONDS,
		});
		expect(roll(0.6)).toEqual({ kind: "error", status: 500 });
		expect(roll(0.95)).toBeNull();
		const kinds = draw(config, 2_000).map((d) => d.fault?.kind ?? "ok");
		const share = (kind: string) =>
			kinds.filter((k) => k === kind).length / kinds.length;
		expect(share("timeout")).toBeCloseTo(0.2, 1);
		expect(share("rateLimit")).toBeCloseTo(0.3, 1);
		expect(share("error")).toBeCloseTo(0.4, 1);
	});

	it("holds a timeout until the latency maximum, else 10 s", () => {
		const always = (value: Partial<EndpointChaos>) =>
			decideChaos(chaos({ timeoutRate: 1, ...value }), () => 0);
		const ranged = always({ latencyMs: [200, 2_500] });
		expect(ranged.fault).toEqual({ kind: "timeout", holdMs: 2_500 });
		expect(waitOf(ranged)).toBe(2_500);
		expect(waitOf(always({}))).toBe(DEFAULT_TIMEOUT_HOLD_MS);
		expect(waitOf({ latencyMs: 30, fault: null })).toBe(30);
	});

	it("clamps stored values past the limits", () => {
		const stored = {
			...chaos({}),
			latencyMs: [-5, 99_999] as [number, number],
		};
		const decision = decideChaos(stored, () => 0.999_999);
		expect(decision.latencyMs).toBe(30_000);
	});
});

describe("chaos waits", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("waits on a timer and stops early when the client leaves", async () => {
		vi.useFakeTimers();
		const done = sleep(1_000);
		await vi.advanceTimersByTimeAsync(1_000);
		await expect(done).resolves.toBe(true);
		const controller = new AbortController();
		const cut = sleep(30_000, controller.signal);
		controller.abort();
		await expect(cut).resolves.toBe(false);
		expect(vi.getTimerCount()).toBe(0);
	});

	it("caps the waits in flight per project and frees slots after", async () => {
		vi.useFakeTimers();
		const gate = new DelayGate(2);
		const controller = new AbortController();
		const first = gate.wait("p1", 500);
		const second = gate.wait("p1", 500, controller.signal);
		await expect(gate.wait("p1", 500)).resolves.toBe("busy");
		// Zero waits need no slot; other projects have their own.
		await expect(gate.wait("p1", 0)).resolves.toBe("done");
		const other = gate.wait("p2", 500);
		controller.abort();
		await expect(second).resolves.toBe("aborted");
		expect(gate.inFlight("p1")).toBe(1);
		await vi.advanceTimersByTimeAsync(500);
		await expect(first).resolves.toBe("done");
		await expect(other).resolves.toBe("done");
		expect(gate.inFlight("p1")).toBe(0);
	});
});
