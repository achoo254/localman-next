/**
 * TEST ONLY. The components of the Swagger Petstore (OpenAPI 3) sample,
 * trimmed to what the resource import reads: `Pet` holds `tags: Tag[]`
 * and a single `Category`; `Customer` holds `address: Address[]`.
 */
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });

export const PETSTORE_OPENAPI = {
	openapi: "3.0.4",
	info: { title: "Swagger Petstore - OpenAPI 3.0", version: "1.0.27" },
	paths: {},
	components: {
		schemas: {
			Order: {
				type: "object",
				properties: {
					id: { type: "integer", format: "int64" },
					petId: { type: "integer", format: "int64" },
					quantity: { type: "integer", format: "int32" },
					shipDate: { type: "string", format: "date-time" },
					status: { type: "string", enum: ["placed", "approved", "delivered"] },
					complete: { type: "boolean" },
				},
			},
			Customer: {
				type: "object",
				properties: {
					id: { type: "integer", format: "int64" },
					username: { type: "string" },
					address: { type: "array", items: ref("Address") },
				},
			},
			Address: {
				type: "object",
				properties: {
					street: { type: "string" },
					city: { type: "string" },
					state: { type: "string" },
					zip: { type: "string" },
				},
			},
			Category: {
				type: "object",
				properties: {
					id: { type: "integer", format: "int64" },
					name: { type: "string" },
				},
			},
			User: {
				type: "object",
				properties: {
					id: { type: "integer", format: "int64" },
					username: { type: "string" },
					email: { type: "string" },
					phone: { type: "string" },
				},
			},
			Tag: {
				type: "object",
				properties: {
					id: { type: "integer", format: "int64" },
					name: { type: "string" },
				},
			},
			Pet: {
				required: ["name", "photoUrls"],
				type: "object",
				properties: {
					id: { type: "integer", format: "int64" },
					name: { type: "string" },
					category: ref("Category"),
					photoUrls: { type: "array", items: { type: "string" } },
					tags: { type: "array", items: ref("Tag") },
					status: { type: "string", enum: ["available", "pending", "sold"] },
				},
			},
			ApiResponse: {
				type: "object",
				properties: {
					code: { type: "integer", format: "int32" },
					type: { type: "string" },
					message: { type: "string" },
				},
			},
		},
	},
};
