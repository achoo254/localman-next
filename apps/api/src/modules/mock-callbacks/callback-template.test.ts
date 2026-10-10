import { describe, expect, it } from "vitest";
import { renderTemplate } from "./callback-template.js";

const context = {
	event: "create",
	resource: "users",
	record: { id: "7", name: 'Ada "the first"', tags: ["a"], meta: { age: 36 } },
};

describe("callback templates", () => {
	it("fills record, fields, event and resource as JSON-safe text", () => {
		const body = renderTemplate(
			'{"e":"{{event}}","r":"{{ resource }}","n":"{{record.name}}","age":{{record.meta.age}},"rec":{{record}}}',
			context,
		);
		expect(JSON.parse(body)).toEqual({
			e: "create",
			r: "users",
			n: 'Ada "the first"',
			age: 36,
			rec: context.record,
		});
	});

	it("leaves missing fields empty and unknown variables as written", () => {
		expect(renderTemplate("[{{record.nope}}]{{other}}", context)).toBe(
			"[]{{other}}",
		);
		expect(renderTemplate("{{record.tags}}", context)).toBe('["a"]');
	});

	it("never reaches inherited properties or evaluates anything", () => {
		expect(renderTemplate("{{record.constructor}}", context)).toBe("");
		expect(renderTemplate("{{record.__proto__}}", context)).toBe("");
		expect(renderTemplate("{{ process.exit(1) }}", context)).toBe(
			"{{ process.exit(1) }}",
		);
	});
});
