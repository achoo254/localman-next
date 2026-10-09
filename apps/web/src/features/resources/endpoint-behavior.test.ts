import { RULE_OPS, RULE_SOURCES } from "@localman/shared/endpoint-behavior";
import { describe, expect, it } from "vitest";
import { en } from "../../i18n/messages/en/dictionary";
import { createTranslator } from "../../i18n/translate";
import { ApiError } from "../../lib/api-client";
import { chaosSummary } from "./behavior-summary";
import {
	NO_CHAOS,
	type RuleDraft,
	chaosDraftOf,
	ruleDraft,
} from "./endpoint-behavior-draft";
import { RULE_OP_LIST, RULE_SOURCE_LIST } from "./endpoint-behavior-model";
import { checkBehavior } from "./endpoint-behavior-validation";
import { revealErrors, serverBehaviorErrors } from "./resource-form-errors";
import { type EndpointDraft, draftOf } from "./resource-form-state";

const { t } = createTranslator("en", en);

function endpoint(patch: Partial<EndpointDraft> = {}): EndpointDraft {
	const [first] = draftOf(null).endpoints;
	if (!first) throw new Error("no endpoint");
	return { ...first, ...patch };
}

function rule(patch: Partial<RuleDraft>): RuleDraft {
	return { ...ruleDraft(), target: "x-role", value: "admin", ...patch };
}

describe("endpoint chaos", () => {
	it("keeps the shared operator and source lists", () => {
		expect([...RULE_OP_LIST]).toEqual([...RULE_OPS]);
		expect([...RULE_SOURCE_LIST]).toEqual([...RULE_SOURCES]);
	});

	it("turns percentages into rates and drops chaos left at zero", () => {
		const chaos = {
			...NO_CHAOS,
			min: "200",
			max: "1500",
			errorRate: "10",
			errorStatus: "503",
			rateLimitRate: "2.5",
			timeoutRate: "5",
		};
		expect(checkBehavior(endpoint({ chaos }), t)).toEqual({
			errors: null,
			chaos: {
				latencyMs: [200, 1500],
				errorRate: 0.1,
				errorStatus: 503,
				timeoutRate: 0.05,
				rateLimitRate: 0.025,
			},
		});
		expect(checkBehavior(endpoint(), t)).toEqual({ errors: null });
		const saved = {
			latencyMs: [0, 0] as [number, number],
			errorRate: 0.07,
			errorStatus: 500,
			timeoutRate: 0,
			rateLimitRate: 0.025,
		};
		expect(chaosDraftOf(saved)).toMatchObject({
			errorRate: "7",
			rateLimitRate: "2.5",
		});
		expect(chaosSummary(chaos, t)).toBe(
			"200–1,500 ms · 10% errors (503) · 2.5% 429s · 5% timeouts",
		);
	});

	it("refuses delays out of range, min over max and rates over 100% together", () => {
		const check = (patch: Partial<typeof NO_CHAOS>) =>
			checkBehavior(endpoint({ chaos: { ...NO_CHAOS, ...patch } }), t).errors
				?.chaos;
		expect(check({ min: "-1", max: "40000" })).toEqual({
			min: "Enter whole milliseconds from 0 to 30,000.",
			max: "Enter whole milliseconds from 0 to 30,000.",
		});
		expect(check({ min: "900", max: "100" })).toEqual({
			max: "Min can't be more than max.",
		});
		expect(check({ errorRate: "101" })).toEqual({
			errorRate: "Enter a percentage from 0 to 100.",
		});
		expect(
			check({ errorRate: "60", timeoutRate: "30", rateLimitRate: "20" }),
		).toEqual({
			rates:
				"Error rate, 429 rate and timeout rate together can't be over 100%.",
		});
	});
});

describe("API validation errors of chaos and rules", () => {
	it("lands on the field holding the value and opens its panel and rule", () => {
		const draft = draftOf(null);
		const failing = rule({});
		draft.endpoints[2] = endpoint({
			...draft.endpoints[2],
			rules: [failing],
			panel: null,
		});
		const error = new ApiError(400, "VALIDATION_ERROR", "Invalid input", [
			{ path: "endpoints.2.rules.0.value", message: "Too long" },
			{ path: "endpoints.0.chaos.latencyMs.0", message: "Too small" },
			{ path: "name", message: "elsewhere" },
		]);
		const errors = serverBehaviorErrors(error, draft, t);
		const post = errors?.behavior["POST /:res"];
		expect(post?.rules[failing.key]).toEqual({
			value: "Not accepted: Too long",
		});
		expect(errors?.behavior["GET /:res"]?.chaos).toEqual({
			min: "Not accepted: Too small",
		});
		if (!errors) return;
		const revealed = revealErrors(draft, errors);
		expect(revealed.endpoints[2]?.panel).toBe("rules");
		expect(revealed.endpoints[2]?.rules[0]?.open).toBe(true);
		expect(revealed.endpoints[0]?.panel).toBe("chaos");
	});

	it("leaves other errors to the form's message", () => {
		const draft = draftOf(null);
		const other = new ApiError(400, "VALIDATION_ERROR", "Invalid", [
			{ path: "schema.0.name", message: "Bad" },
		]);
		expect(serverBehaviorErrors(other, draft, t)).toBeNull();
		expect(serverBehaviorErrors(new Error("x"), draft, t)).toBeNull();
	});
});
