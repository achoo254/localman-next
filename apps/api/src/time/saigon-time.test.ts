import { describe, expect, it } from "vitest";
import { endOfSaigonDay, saigonDate, saigonMonth } from "./saigon-time.js";

describe("Saigon calendar", () => {
	it("switches month at midnight UTC+7, not UTC", () => {
		expect(saigonMonth(new Date("2026-10-31T16:59:59Z"))).toBe("2026-10");
		expect(saigonMonth(new Date("2026-10-31T17:00:00Z"))).toBe("2026-11");
		expect(saigonDate(new Date("2026-12-31T17:00:00Z"))).toBe("2027-01-01");
	});

	it("ends a day at 23:59:59.999 in Saigon and rejects impossible dates", () => {
		expect(endOfSaigonDay("2026-12-31")?.toISOString()).toBe(
			"2026-12-31T16:59:59.999Z",
		);
		for (const bad of ["2026-02-30", "2026-13-01", "31/12/2026", ""]) {
			expect(endOfSaigonDay(bad)).toBeNull();
		}
	});
});
