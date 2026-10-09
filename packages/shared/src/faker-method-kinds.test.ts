import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import { type FakerMethodKind, fakerMethodKind } from "./faker-method-kinds.js";
import { FAKER_METHODS } from "./faker-methods.js";
import type { JsonValue } from "./json-value.js";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

function fits(kind: FakerMethodKind, value: JsonValue): boolean {
	switch (kind) {
		case "string":
			return typeof value === "string";
		case "date":
			return typeof value === "string" && ISO_DATE.test(value);
		case "number":
			return typeof value === "number";
		case "boolean":
			return typeof value === "boolean";
		case "number-array":
			return (
				Array.isArray(value) && value.every((item) => typeof item === "number")
			);
		case "object":
			return (
				value !== null && typeof value === "object" && !Array.isArray(value)
			);
	}
}

describe("fakerMethodKind", () => {
	it.each(FAKER_METHODS.map((method) => [method.id, method] as const))(
		"%s returns what the table says",
		(id, method) => {
			faker.seed(19);
			const kind = fakerMethodKind(id);
			for (let run = 0; run < 10; run += 1) {
				expect(fits(kind, method.run(faker)), `${id} as ${kind}`).toBe(true);
			}
		},
	);

	it("treats an unknown id as a string method", () => {
		expect(fakerMethodKind("__proto__")).toBe("string");
	});
});
