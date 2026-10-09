import { describe, expect, it } from "vitest";
import {
	MAX_OPENAPI_BYTES,
	openApiSchemaNames,
	readOpenApiInput,
} from "./openapi-document.js";
import { resourceFieldsSchema } from "./resource-schema.js";
import {
	type OpenApiImportResult,
	schemaFromOpenApi,
} from "./schema-from-openapi.js";

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const PETSTORE = {
	openapi: "3.0.3",
	info: { title: "Petstore", version: "1" },
	paths: {
		"/pets/{petId}": {
			get: {
				responses: {
					"200": { content: { "application/json": { schema: ref("Pet") } } },
				},
			},
		},
		"/orders": {
			post: {
				requestBody: { $ref: "#/components/requestBodies/Order" },
				responses: { "204": { description: "none" } },
			},
			get: {
				responses: {
					"200": {
						content: {
							"application/json": {
								schema: {
									type: "array",
									items: {
										type: "object",
										properties: { total: { type: "number" } },
									},
								},
							},
						},
					},
				},
			},
		},
	},
	components: {
		schemas: {
			Pet: {
				type: "object",
				required: ["name"],
				properties: {
					id: { type: "integer", format: "int64" },
					name: { type: "string" },
					category: ref("Category"),
					photoUrls: {
						type: "array",
						items: { type: "string", format: "uri" },
					},
					tags: { type: "array", items: ref("Tag") },
					status: { type: "string", enum: ["available", "pending", "sold"] },
					owner: { allOf: [ref("Owner")], nullable: true },
					bornAt: { type: "string", format: "date-time" },
					homepage: { type: ["string", "null"], format: "uri" },
					vaccinated: { type: "boolean", nullable: true },
					sire: ref("Pet"),
				},
			},
			Category: {
				type: "object",
				properties: { id: { type: "integer" }, name: { type: "string" } },
			},
			Tag: { type: "object", properties: { name: { type: "string" } } },
			Owner: {
				type: "object",
				properties: { email: { type: "string", format: "email" } },
			},
			Admin: {
				allOf: [ref("Owner"), { properties: { role: { const: "admin" } } }],
			},
		},
		requestBodies: {
			Order: { content: { "application/json": { schema: ref("Tag") } } },
		},
	},
};

function fieldsOf(result: OpenApiImportResult) {
	if (!result.ok)
		throw new Error(`${result.error.code}: ${result.error.message}`);
	expect(resourceFieldsSchema.safeParse(result.fields).success).toBe(true);
	return result.fields;
}

describe("schemaFromOpenApi", () => {
	it("imports a component with references to other components", () => {
		const result = schemaFromOpenApi(PETSTORE, { schema: "Pet" });
		expect(fieldsOf(result)).toMatchSnapshot();
		expect(result.ok && result.references).toEqual([
			{ field: "category", schema: "Category", many: false },
			{ field: "tags", schema: "Tag", many: true },
			{ field: "owner", schema: "Owner", many: false },
			{ field: "sire", schema: "Pet", many: false },
		]);
		expect(result.ok && result.warnings).toMatchSnapshot();
	});

	it("accepts the same document as JSON text and defaults to the first schema", () => {
		const result = schemaFromOpenApi(JSON.stringify(PETSTORE));
		expect(result.ok && result.name).toBe("Pet");
		expect(openApiSchemaNames(readOpenApiInput(PETSTORE))).toEqual([
			"Pet",
			"Category",
			"Tag",
			"Owner",
			"Admin",
		]);
	});

	it("merges allOf and picks a path's JSON body", () => {
		const admin = schemaFromOpenApi(PETSTORE, { schema: "Admin" });
		expect(fieldsOf(admin)).toEqual([
			{ name: "email", type: "Faker.js", fakerMethod: "internet.email" },
			{ name: "role", type: "String" },
		]);
		const pet = schemaFromOpenApi(PETSTORE, { path: "/pets/{petId}" });
		expect(pet.ok && pet.name).toBe("Pet");
		const orders = schemaFromOpenApi(PETSTORE, { path: "/orders" });
		expect(orders.ok && orders.name).toBe("orders");
		expect(fieldsOf(orders)).toEqual([{ name: "total", type: "Number" }]);
		const pathsOnly = schemaFromOpenApi({
			openapi: "3.1.0",
			paths: {
				"/items": {
					get: {
						responses: {
							default: {
								content: {
									"application/vnd.api+json": {
										schema: { properties: { label: { type: "string" } } },
									},
								},
							},
						},
					},
				},
			},
		});
		expect(pathsOnly.ok && pathsOnly.name).toBe("items");
		expect(fieldsOf(pathsOnly)).toEqual([{ name: "label", type: "String" }]);
	});

	it("reads a bare Schema Object or JSON Schema", () => {
		const result = schemaFromOpenApi({
			title: "Event",
			type: "object",
			properties: {
				uid: { type: "string", format: "uuid" },
				kind: { const: "click" },
				at: { type: "string", format: "date" },
				count: { type: "integer" },
				payload: { additionalProperties: true, type: "object" },
				extra: true,
			},
		});
		expect(fieldsOf(result)).toMatchSnapshot();
		expect(result.ok && result.name).toBe("Event");
	});
});
