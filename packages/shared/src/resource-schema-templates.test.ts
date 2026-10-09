import { describe, expect, it } from "vitest";
import { z } from "zod";
import { resourceCreateSchema } from "./resource-schema.js";
import { completeEndpoints } from "./resource-templates.js";

const messages = (result: z.ZodSafeParseResult<unknown>): string[] =>
	result.success ? [] : result.error.issues.map((issue) => issue.message);

describe("templates and endpoints", () => {
	it("allows Faker refs in the object template but not response variables", () => {
		const ok = resourceCreateSchema.parse({
			name: "users",
			template: { profile: { name: "$name.fullName" }, tags: ["$word.noun"] },
		});
		expect(ok.template).toEqual({
			profile: { name: "$name.fullName" },
			tags: ["$word.noun"],
		});
		expect(
			messages(
				resourceCreateSchema.safeParse({
					name: "users",
					template: { all: "$mockData", x: "$constructor.constructor" },
				}),
			),
		).toEqual([
			'all: Unknown template variable "$mockData"',
			'x: Unknown Faker method "$constructor.constructor"',
		]);
		expect(
			resourceCreateSchema.safeParse({ name: "users", template: [1] }).success,
		).toBe(false);
		expect(resourceCreateSchema.parse({ name: "u" }).template).toBeUndefined();
		expect(
			resourceCreateSchema.parse({ name: "u", template: null }).template,
		).toBeNull();
	});

	it("validates custom responses and only the five known endpoints", () => {
		const parsed = resourceCreateSchema.parse({
			name: "users",
			endpoints: [
				{
					method: "GET",
					path: "/:res",
					response: { data: "$mockData", total: "$count" },
				},
				{ method: "DELETE", path: "/:res/:id", enabled: false },
				{ method: "POST", path: "/:res", response: null },
			],
		});
		const endpoints = completeEndpoints(parsed.endpoints);
		expect(endpoints).toHaveLength(5);
		expect(endpoints[0]).toEqual({
			method: "GET",
			path: "/:res",
			enabled: true,
			response: { data: "$mockData", total: "$count" },
		});
		expect(endpoints[2]?.response).toBeNull();
		expect(endpoints[4]).toMatchObject({
			enabled: false,
			response: "$mockData",
		});
		for (const endpoints of [
			[{ method: "POST", path: "/:res/:id" }],
			[
				{ method: "GET", path: "/:res" },
				{ method: "GET", path: "/:res" },
			],
			[{ method: "GET", path: "/:res", response: "$mockdata" }],
		]) {
			expect(
				resourceCreateSchema.safeParse({ name: "u", endpoints }).success,
			).toBe(false);
		}
	});

	it("converts to JSON Schema for MCP and OpenAPI", () => {
		expect(() =>
			z.toJSONSchema(resourceCreateSchema, { io: "input" }),
		).not.toThrow();
	});
});
