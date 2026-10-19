import type { CollectionDetail } from "@localman/shared/api-client";
import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { ADA, VIC } from "../access/testing/access-fixture.js";
import {
	teamOfThree,
	useCollectionTestDb,
} from "./testing/collection-fixture.js";

useCollectionTestDb();

const importAs = (sub: string, ws: string, body: object) =>
	as(sub).send("post", `/workspaces/${ws}/collections/import`, body);

const requestNames = (detail: CollectionDetail) =>
	detail.nodes
		.filter((node) => node.kind === "request")
		.map((node) => node.name)
		.sort();

const POSTMAN = JSON.stringify({
	info: {
		name: "Shop",
		schema:
			"https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
	},
	item: [
		{
			name: "Orders",
			item: [
				{
					name: "List orders",
					request: { method: "GET", url: "https://api.example.com/orders" },
				},
			],
		},
	],
	variable: [{ key: "baseUrl", value: "https://api.example.com" }],
});

const OPENAPI = JSON.stringify({
	openapi: "3.0.3",
	info: { title: "Pets", version: "1.0.0" },
	servers: [{ url: "https://pets.example.com" }],
	paths: {
		"/pets": {
			get: {
				summary: "List pets",
				responses: { "200": { description: "ok" } },
			},
			post: {
				summary: "Add a pet",
				responses: { "201": { description: "ok" } },
			},
		},
	},
});

describe("importing a collection from text", () => {
	it("imports a Postman v2.1 collection with its folder and variables", async () => {
		const ws = (await teamOfThree()).toHexString();
		const res = await importAs(ADA, ws, { text: POSTMAN });
		expect(res.status, JSON.stringify(res.body)).toBe(201);
		expect(res.body.format).toBe("collection-v21");
		const detail = res.body.collection as CollectionDetail;
		expect(detail.name).toBe("Shop");
		expect(detail.nodes.some((node) => node.kind === "folder")).toBe(true);
		expect(requestNames(detail)).toEqual(["List orders"]);
		expect(detail.variables.map((v) => v.key)).toEqual(["baseUrl"]);
		const listed = await as(ADA).get(`/workspaces/${ws}/collections`);
		expect(listed.body.items).toHaveLength(1);
	});

	it("imports an OpenAPI document and a cURL command, renamed on request", async () => {
		const ws = (await teamOfThree()).toHexString();
		const api = await importAs(ADA, ws, { text: OPENAPI });
		expect(api.status, JSON.stringify(api.body)).toBe(201);
		expect(api.body.format).toBe("openapi");
		expect(requestNames(api.body.collection)).toEqual([
			"Add a pet",
			"List pets",
		]);
		const curl = await importAs(ADA, ws, {
			text: "curl -X POST https://api.example.com/users -H 'Content-Type: application/json' -d '{\"name\":\"Ada\"}'",
			name: "Users",
		});
		expect(curl.status, JSON.stringify(curl.body)).toBe(201);
		expect(curl.body.format).toBe("curl");
		expect(curl.body.collection.name).toBe("Users");
		const [request] = curl.body.collection.nodes;
		expect(request?.kind === "request" && request.draft.method).toBe("POST");
	});

	it("explains what it cannot import", async () => {
		const ws = (await teamOfThree()).toHexString();
		const broken = await importAs(ADA, ws, { text: "{ not json" });
		expect(broken.status).toBe(400);
		expect(broken.body.error).toMatchObject({
			code: "IMPORT_FAILED",
			details: { reason: "INVALID_JSON" },
		});
		const unknown = await importAs(ADA, ws, { text: '{"hello":"world"}' });
		expect(unknown.body.error.details.reason).toBe("UNKNOWN_FORMAT");
		const environment = await importAs(ADA, ws, {
			text: JSON.stringify({
				name: "Staging",
				values: [{ key: "baseUrl", value: "https://a.test", enabled: true }],
				_postman_variable_scope: "environment",
			}),
		});
		expect(environment.status).toBe(400);
		expect(environment.body.error.code).toBe("IMPORT_NOT_A_COLLECTION");
		const listed = await as(ADA).get(`/workspaces/${ws}/collections`);
		expect(listed.body.items).toHaveLength(0);
	});

	it("lets only Admins and Editors of the workspace import", async () => {
		const ws = (await teamOfThree()).toHexString();
		const res = await importAs(VIC, ws, { text: POSTMAN });
		expect(res.status).toBe(403);
	});
});
