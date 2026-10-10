import { describe, expect, it } from "vitest";
import { en } from "../../i18n/messages/en/dictionary";
import { createTranslator } from "../../i18n/translate";
import { ApiError } from "../../lib/api-client";
import { parentKeyError, serverParentKeyError } from "./parent-key";
import { type FormPlace, draftOf, fieldDraft } from "./resource-form-state";
import { validateDraft } from "./resource-form-validation";

const { t } = createTranslator("en", en);

const NESTED: FormPlace = {
	parentKey: "userId",
	parentName: "users",
	children: [],
	siblingNames: [],
};

const draftWithKey = (parentKey: string) => ({
	...draftOf(null),
	name: "posts",
	parentKey,
	fields: [{ ...fieldDraft(), name: "title" }],
});

describe("parentKeyError", () => {
	it("accepts a JavaScript identifier up to 64 characters", () => {
		for (const key of ["ownerId", "_id2", "$ref", "a".repeat(64)]) {
			expect(parentKeyError(key, [], t), key).toBeUndefined();
		}
	});

	it("refuses what the API refuses, with the reason", () => {
		expect(parentKeyError("", [], t)).toBe("Enter a parent key.");
		expect(parentKeyError("a".repeat(65), [], t)).toBe(
			"The parent key can be at most 64 characters.",
		);
		for (const key of ["user-id", "2ndId", "user id", "userÍd"]) {
			expect(parentKeyError(key, [], t), key).toMatch(/^Use letters, numbers/);
		}
		expect(parentKeyError("id", [], t)).toMatch(/record's own id/);
		expect(parentKeyError("title", ["title"], t)).toBe(
			"The field “title” already has this name.",
		);
		for (const key of ["__proto__", "constructor", "prototype"]) {
			expect(parentKeyError(key, [], t), key).toBe(
				`The name “${key}” can't be used.`,
			);
		}
	});
});

describe("serverParentKeyError", () => {
	const refused = (details: unknown) =>
		new ApiError(400, "VALIDATION_ERROR", "Invalid parentKey", details);

	it("places a 400 on parentKey on the field", () => {
		expect(
			serverParentKeyError(
				refused([{ path: "parentKey", message: "taken" }]),
				"title",
				["title"],
				t,
			),
		).toBe("The field “title” already has this name.");
		expect(
			serverParentKeyError(refused({ path: "parentKey" }), "ownerId", [], t),
		).toBe("This parent key can't be used. Pick another name.");
	});

	it("blames the key when stored records already hold that field", () => {
		const conflict = new ApiError(409, "FIELD_CONFLICT", "conflict");
		expect(serverParentKeyError(conflict, "ownerId", [], t)).toBe(
			"Records of this resource already have a field “ownerId”. Pick another key.",
		);
	});

	it("leaves other errors to the form", () => {
		const elsewhere = refused([{ path: "name", message: "bad" }]);
		expect(serverParentKeyError(elsewhere, "ownerId", [], t)).toBeNull();
		const other = new ApiError(409, "RESOURCE_NAME_TAKEN", "taken");
		expect(serverParentKeyError(other, "ownerId", [], t)).toBeNull();
	});
});

describe("validateDraft with a parent key", () => {
	it("sends a changed key, trimmed", () => {
		const { input, errors } = validateDraft(
			draftWithKey(" ownerId "),
			NESTED,
			t,
		);
		expect(errors.parentKey).toBeUndefined();
		expect(input?.parentKey).toBe("ownerId");
	});

	it("leaves an unchanged key out of the body, even an old irregular one", () => {
		expect(
			validateDraft(draftWithKey("userId"), NESTED, t).input,
		).not.toHaveProperty("parentKey");
		const legacy = { ...NESTED, parentKey: "customer-rel-01Id" };
		const { input, errors } = validateDraft(
			draftWithKey("customer-rel-01Id"),
			legacy,
			t,
		);
		expect(errors.parentKey).toBeUndefined();
		expect(input).not.toBeNull();
		expect(input).not.toHaveProperty("parentKey");
	});

	it("blocks a changed key that clashes with a field", () => {
		const { input, errors } = validateDraft(draftWithKey("title"), NESTED, t);
		expect(input).toBeNull();
		expect(errors.parentKey).toBe("The field “title” already has this name.");
		expect(errors.fields).toEqual({});
	});

	it("blocks a key used by the object template", () => {
		const draft = {
			...draftWithKey("ownerId"),
			template: '{"ownerId": "$string.uuid", "title": "$lorem.word"}',
		};
		expect(validateDraft(draft, NESTED, t).errors.parentKey).toBe(
			"The field “ownerId” already has this name.",
		);
	});

	it("frees the old key for a field once the key changes", () => {
		const draft = {
			...draftWithKey("ownerId"),
			fields: [{ ...fieldDraft(), name: "userId" }],
		};
		expect(validateDraft(draft, NESTED, t).errors.fields).toEqual({});
		const kept = { ...draft, parentKey: "userId" };
		expect(Object.values(validateDraft(kept, NESTED, t).errors.fields)).toEqual(
			["Field “userId” is generated automatically."],
		);
	});
});
