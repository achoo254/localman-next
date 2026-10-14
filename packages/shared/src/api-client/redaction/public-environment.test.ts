import { describe, expect, it } from "vitest";
import type { SharedVariable } from "../environments/environment-model.js";
import { publicEnvironment } from "./public-collection.js";

describe("publicEnvironment", () => {
	const variable = (
		key: string,
		sharedValue: string | null,
		type: SharedVariable["type"] = "default",
		enabled = true,
	): SharedVariable => ({
		id: key,
		key,
		type,
		enabled,
		description: "",
		sharedValue,
	});

	it("keeps shared values of plain variables, drops secret and unshared ones", () => {
		expect(
			publicEnvironment({
				name: "Staging",
				variables: [
					variable("host", "https://s.test"),
					variable("token", "abc", "secret"),
					variable("mine", null),
					variable("off", "x", "default", false),
				],
			}),
		).toEqual({
			name: "Staging",
			variables: [
				{ key: "host", value: "https://s.test" },
				{ key: "off", value: "x", enabled: false },
			],
		});
	});
});
