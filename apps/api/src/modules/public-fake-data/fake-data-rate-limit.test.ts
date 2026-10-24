import { describe, expect, it } from "vitest";
import { createIpMinuteLimiter } from "./fake-data-rate-limit.js";

describe("createIpMinuteLimiter", () => {
	it("opens a new window after a minute", () => {
		let now = 0;
		const take = createIpMinuteLimiter(2, { now: () => now });
		take("198.51.100.1");
		take("198.51.100.1");
		expect(() => take("198.51.100.1")).toThrow(/Too many requests/);
		now = 60_000;
		expect(() => take("198.51.100.1")).not.toThrow();
	});

	it("counts an IPv6 /64 as one address", () => {
		const take = createIpMinuteLimiter(1, { now: () => 0 });
		take("2001:db8:1:2::1");
		expect(() => take("2001:db8:1:2::ff")).toThrow(/Too many requests/);
		expect(() => take("2001:db8:1:3::1")).not.toThrow();
	});

	it("drops expired windows first when full, and keeps the live ones", () => {
		let now = 0;
		const take = createIpMinuteLimiter(1, { now: () => now, maxTracked: 3 });
		take("198.51.100.1");
		now = 30_000;
		take("198.51.100.2");
		take("198.51.100.3");
		now = 61_000;
		// Full: only .1 has expired, so .2 and .3 keep counting.
		take("198.51.100.4");
		expect(() => take("198.51.100.2")).toThrow(/Too many requests/);
		expect(() => take("198.51.100.3")).toThrow(/Too many requests/);
	});

	it("drops the oldest live windows when full of live ones", () => {
		const take = createIpMinuteLimiter(1, { now: () => 0, maxTracked: 3 });
		take("198.51.100.1");
		take("198.51.100.2");
		take("198.51.100.3");
		// Full and all live: the oldest (.1) is forgotten to make room.
		take("198.51.100.4");
		expect(() => take("198.51.100.3")).toThrow(/Too many requests/);
		expect(() => take("198.51.100.1")).not.toThrow();
	});

	it("says how long to wait", () => {
		let now = 0;
		const take = createIpMinuteLimiter(1, { now: () => now });
		take("198.51.100.9");
		now = 45_500;
		expect(() => take("198.51.100.9")).toThrow(
			expect.objectContaining({ details: { retryAfterSeconds: 15 } }),
		);
	});
});
