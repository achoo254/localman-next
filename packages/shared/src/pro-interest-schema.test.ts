import { describe, expect, it } from "vitest";
import { proInterestSubmissionSchema } from "./pro-interest-schema.js";

const valid = {
	email: "  Nguyen@Gmail.COM ",
	name: "Nguyễn",
	needs: ["mock", "team"],
	teamSize: "2-5",
	source: "landing",
	consent: true,
};

describe("proInterestSubmissionSchema", () => {
	it("normalizes the email and keeps the choices", () => {
		const parsed = proInterestSubmissionSchema.parse(valid);
		expect(parsed.email).toBe("nguyen@gmail.com");
		expect(parsed.needs).toEqual(["mock", "team"]);
	});

	it("stores a missing or unknown source as other", () => {
		const { source: _source, ...rest } = valid;
		expect(proInterestSubmissionSchema.parse(rest).source).toBe("other");
		expect(
			proInterestSubmissionSchema.parse({ ...valid, source: "Landing Page" })
				.source,
		).toBe("other");
		expect(
			proInterestSubmissionSchema.parse({
				...valid,
				source: "plan_limit_proxy",
			}).source,
		).toBe("plan_limit_proxy");
	});

	it.each([
		{ consent: false },
		{ consent: undefined },
		{ email: "not-an-email" },
		{ needs: [] },
		{ needs: ["mock", "mock"] },
		{ needs: ["crypto"] },
		{ teamSize: "100" },
	])("rejects %j", (override) => {
		expect(
			proInterestSubmissionSchema.safeParse({ ...valid, ...override }).success,
		).toBe(false);
	});
});
