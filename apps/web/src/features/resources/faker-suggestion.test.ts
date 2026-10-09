import { describe, expect, it } from "vitest";
import { suggestMethod } from "./faker-suggestion";
import { type FieldDraft, fieldDraft } from "./resource-form-state";

function field(patch: Partial<FieldDraft>): FieldDraft {
	return { ...fieldDraft(), ...patch };
}

describe("Faker method suggested from the field name", () => {
	it("fills a new Faker.js field and marks it suggested", () => {
		expect(suggestMethod(field({ name: "email" }))).toEqual({
			fakerMethod: "internet.email",
			methodSource: "suggested",
		});
		expect(suggestMethod(field({ name: "so_dien_thoai" }))).toMatchObject({
			fakerMethod: "phone.number",
		});
	});

	it("never overrides a method the user picked", () => {
		const picked = field({
			name: "email",
			fakerMethod: "lorem.word",
			methodSource: "user",
		});
		expect(suggestMethod(picked)).toBeNull();
	});

	it("leaves saved fields alone until they are renamed", () => {
		const saved = fieldDraft({
			name: "contact",
			type: "Faker.js",
			fakerMethod: "lorem.word",
		});
		expect(saved.methodSource).toBe("saved");
		expect(suggestMethod(saved)).toBeNull();
		expect(suggestMethod({ ...saved, name: "avatar" })).toEqual({
			fakerMethod: "image.avatar",
			methodSource: "suggested",
		});
	});

	it("skips other types and names it can't match", () => {
		expect(suggestMethod(field({ name: "email", type: "String" }))).toBeNull();
		expect(suggestMethod(field({ name: "qwzx" }))).toBeNull();
		expect(
			suggestMethod(
				field({
					name: "qwzx",
					fakerMethod: "internet.email",
					methodSource: "suggested",
				}),
			),
		).toEqual({ methodSource: "default" });
	});
});
