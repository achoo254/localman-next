import { describe, expect, it } from "vitest";
import { en } from "../../i18n/messages/en/dictionary";
import { createTranslator } from "../../i18n/translate";
import { type FormPlace, draftOf, fieldDraft } from "./resource-form-state";
import { validateDraft } from "./resource-form-validation";

const { t } = createTranslator("en", en);

const ROOT: FormPlace = {
	parentKey: null,
	parentName: null,
	children: [],
	siblingNames: ["users"],
};

const NESTED: FormPlace = {
	parentKey: "userId",
	parentName: "users",
	children: [{ id: "c1", name: "comments" }],
	siblingNames: [],
};

describe("validateDraft", () => {
	it("builds the API body of a valid draft", () => {
		const draft = { ...draftOf(null), name: " orders " };
		const { input, errors } = validateDraft(draft, ROOT, t);
		expect(errors).toEqual({ fields: {}, endpoints: {} });
		expect(input?.name).toBe("orders");
		expect(input?.template).toBeNull();
		expect(input?.endpoints[0]).toEqual({
			method: "GET",
			path: "/:res",
			enabled: true,
			response: "$mockData",
		});
	});

	it("refuses bad, taken and missing names", () => {
		const draft = draftOf(null);
		expect(validateDraft({ ...draft, name: "" }, ROOT, t).errors.name).toBe(
			"Enter a resource name.",
		);
		expect(
			validateDraft({ ...draft, name: "đơn hàng" }, ROOT, t).errors.name,
		).toMatch(/Use only unaccented letters/);
		expect(
			validateDraft({ ...draft, name: "users" }, ROOT, t).errors.name,
		).toBe("There's already a resource with this name here.");
		expect(
			validateDraft({ ...draft, name: "mcp" }, ROOT, t).errors.name,
		).toMatch(/reserved for the project's MCP endpoint/);
	});

	it("keeps generated, duplicate and unknown fields out", () => {
		const parentId = { ...fieldDraft(), name: "userId" };
		const twice = { ...fieldDraft(), name: "title" };
		const again = { ...fieldDraft(), name: "title" };
		const unknown = {
			...fieldDraft(),
			name: "x",
			fakerMethod: "person.fullName",
		};
		const child = {
			...fieldDraft(),
			name: "kids",
			type: "Child Resource" as const,
			childId: "nope",
		};
		const draft = {
			...draftOf(null),
			name: "posts",
			fields: [parentId, twice, again, unknown, child],
		};
		const { input, errors } = validateDraft(draft, NESTED, t);
		expect(input).toBeNull();
		expect(errors.fields).toEqual({
			[parentId.key]: "Field “userId” is generated automatically.",
			[again.key]: "Field “title” is a duplicate.",
			[unknown.key]: "Pick a Faker method from the list.",
			[child.key]: "Pick a child resource.",
		});
	});

	it("sends relation fields with only the keys the API accepts", () => {
		const parent = {
			...fieldDraft(),
			name: "owner",
			type: "Parent Resource" as const,
		};
		const child = {
			...fieldDraft(),
			name: "comments",
			type: "Child Resource" as const,
			childId: "c1",
		};
		const { input } = validateDraft(
			{ ...draftOf(null), name: "posts", fields: [parent, child] },
			NESTED,
			t,
		);
		expect(input?.schema).toEqual([
			{ name: "owner", type: "Parent Resource" },
			{ name: "comments", type: "Child Resource", childId: "c1" },
		]);
	});

	it("refuses a second relation field reading the same resource", () => {
		const relation = (
			name: string,
			type: "Parent Resource" | "Child Resource",
		) => ({
			...fieldDraft(),
			name,
			type,
			childId: type === "Child Resource" ? "c1" : "",
		});
		const fields = [
			relation("owner", "Parent Resource"),
			relation("comments", "Child Resource"),
			relation("author", "Parent Resource"),
			relation("replies", "Child Resource"),
		];
		const { input, errors } = validateDraft(
			{ ...draftOf(null), name: "posts", fields },
			NESTED,
			t,
		);
		expect(input).toBeNull();
		expect(errors.fields).toEqual({
			[fields[2]?.key ?? ""]: "Field “owner” already reads the parent record.",
			[fields[3]?.key ?? ""]:
				"Field “comments” already reads this child resource.",
		});
	});

	it("checks the template and the responses are JSON", () => {
		const draft = draftOf(null);
		const [first, ...rest] = draft.endpoints;
		if (!first) throw new Error("no endpoint");
		const broken = {
			...draft,
			name: "orders",
			template: '["not", "an object"]',
			endpoints: [{ ...first, response: "{" }, ...rest],
		};
		const { errors } = validateDraft(broken, ROOT, t);
		expect(errors.template).toBe("The object template must be a JSON object.");
		expect(errors.endpoints).toEqual({
			"GET /:res": "The response template isn't valid JSON.",
		});
		const parsed = validateDraft(
			{ ...draft, name: "orders", template: '{"email": "$internet.email"}' },
			ROOT,
			t,
		);
		expect(parsed.input?.template).toEqual({ email: "$internet.email" });
	});
});
