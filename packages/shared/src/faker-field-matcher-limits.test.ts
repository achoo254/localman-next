import { describe, expect, it } from "vitest";
import {
	FAKER_MATCH_CONFIDENCE,
	matchFakerField,
} from "./faker-field-matcher.js";
import { FIELD_NAME_MAX } from "./resource-constants.js";

/** Names of `FIELD_NAME_MAX` characters shaped to split into many tokens. */
const HOSTILE = [
	"aA".repeat(FIELD_NAME_MAX / 2),
	"a_".repeat(FIELD_NAME_MAX / 2),
	"1a".repeat(FIELD_NAME_MAX / 2),
	"Ab".repeat(FIELD_NAME_MAX / 2),
	"ipIp".repeat(FIELD_NAME_MAX / 4),
	"email_".repeat(FIELD_NAME_MAX / 6),
	"a".repeat(FIELD_NAME_MAX),
	"emailemail".repeat(FIELD_NAME_MAX / 10),
];
/** A whole import: 50 resources of 50 fields. */
const NAMES_PER_SHAPE = 2_500;

describe("matchFakerField on hostile names", () => {
	it.each(HOSTILE)("matches 2 500 names like %s quickly", (name) => {
		matchFakerField(name); // Compiles the rule regexes.
		const started = performance.now();
		for (let i = 0; i < NAMES_PER_SHAPE; i += 1) matchFakerField(name, "any");
		expect(performance.now() - started).toBeLessThan(200);
	});

	it("still reads the start and the end of a name with many tokens", () => {
		expect(matchFakerField("a_b_c_d_e_f_g_h_userEmail", "string")).toEqual({
			method: "internet.email",
			confidence: FAKER_MATCH_CONFIDENCE.edge,
		});
		expect(matchFakerField("email_a_b_c_d_e_f_g_h", "string")).toEqual({
			method: "internet.email",
			confidence: FAKER_MATCH_CONFIDENCE.edge,
		});
		// Past eight tokens, only the first and last four are read.
		expect(matchFakerField("a_b_c_d_email_e_f_g_h", "string")).toBeNull();
	});
});
