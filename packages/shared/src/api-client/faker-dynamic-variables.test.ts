import { describe, expect, it } from "vitest";
import { isFakerMethodId } from "../faker-method-catalog.js";
import { runFakerMethodText } from "../faker-methods.js";
import { resolveDynamicVariable } from "./dynamic-variables.js";
import { FAKER_DYNAMIC_VARIABLES } from "./faker-dynamic-variables.js";

const fill = (name: string) => resolveDynamicVariable(name, runFakerMethodText);

/** Shapes Postman documents for these names. */
const SHAPES: ReadonlyArray<readonly [string, RegExp]> = [
	["$randomEmail", /^[^\s@]+@[^\s@]+\.[a-z]+$/i],
	["$randomExampleEmail", /^[^\s@]+@example\.(?:com|net|org)$/i],
	["$randomUserName", /^\S+$/],
	["$randomUrl", /^https?:\/\/\S+$/],
	["$randomImageUrl", /^https?:\/\/\S+$/],
	["$randomImageDataUri", /^data:image\//],
	["$randomDomainName", /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i],
	["$randomIP", /^\d{1,3}(?:\.\d{1,3}){3}$/],
	["$randomIPV6", /^[0-9a-f]{1,4}(?::[0-9a-f]{1,4}){7}$/i],
	["$randomMACAddress", /^[0-9a-f]{2}(?::[0-9a-f]{2}){5}$/i],
	["$randomHexColor", /^#[0-9a-f]{6}$/i],
	["$randomSemver", /^\d+\.\d+\.\d+$/],
	["$randomBoolean", /^(?:true|false)$/],
	["$randomAlphaNumeric", /^[a-z0-9]+$/i],
	["$randomLatitude", /^-?\d+(?:\.\d+)?$/],
	["$randomLongitude", /^-?\d+(?:\.\d+)?$/],
	["$randomPrice", /^\d+(?:\.\d+)?$/],
	["$randomCurrencyCode", /^[A-Z]{3}$/],
	["$randomDateFuture", /^\d{4}-\d{2}-\d{2}T/],
	["$randomDatePast", /^\d{4}-\d{2}-\d{2}T/],
	["$randomDateRecent", /^\d{4}-\d{2}-\d{2}T/],
	["$randomFullName", /^\S+(?: \S+)+$/],
	["$randomLoremSentence", /^\S.*\.$/],
	["$randomMimeType", /^[a-z]+\/\S+$/],
	["$randomFileName", /^\S+\.\w+$/],
];

describe("Faker dynamic variables", () => {
	it.each(Object.entries(FAKER_DYNAMIC_VARIABLES))(
		"%s runs whitelisted %s to non-empty text",
		(name, id) => {
			expect(isFakerMethodId(id)).toBe(true);
			expect(fill(name)).toMatch(/\S/);
		},
	);

	it.each(SHAPES)("%s has a plausible shape", (name, shape) => {
		for (let i = 0; i < 5; i += 1) expect(fill(name)).toMatch(shape);
	});
});
