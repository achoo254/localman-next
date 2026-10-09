import { describe, expect, it } from "vitest";
import { NO_FEATURES, parseFeatureFlags } from "./feature-flags";

describe("parseFeatureFlags", () => {
	it("turns everything off when the variable is missing or empty", () => {
		expect(parseFeatureFlags(undefined)).toEqual(NO_FEATURES);
		expect(parseFeatureFlags(" , ")).toEqual(NO_FEATURES);
	});

	it("turns on the listed features only", () => {
		expect(parseFeatureFlags(" apiClient, mockMcp ")).toEqual({
			...NO_FEATURES,
			apiClient: true,
			mockMcp: true,
		});
	});

	it("rejects an unknown name instead of hiding a feature silently", () => {
		expect(() => parseFeatureFlags("apiclient")).toThrow(/apiclient/);
		expect(() => parseFeatureFlags("toString")).toThrow(/toString/);
	});
});
