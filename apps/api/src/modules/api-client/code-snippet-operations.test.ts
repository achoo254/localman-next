import { describe, expect, it } from "vitest";
import { ALICE, as, useClientStoreDb } from "./testing/client-store-fixture.js";

useClientStoreDb();

const snippet = (body: object) =>
	as(ALICE).send("post", "/client/code-snippets", body);

const POST_JSON = {
	method: "POST",
	url: "https://api.example.com/users?page=2",
	headers: [{ name: "Content-Type", value: "application/json" }],
	body: '{"name":"Ada"}',
	bodyType: "text",
};

describe("code snippets", () => {
	it("turns a request into cURL with its method, headers and body", async () => {
		const res = await snippet({ target: "curl", request: POST_JSON });
		expect(res.status, JSON.stringify(res.body)).toBe(200);
		expect(res.body).toMatchObject({ syntax: "shell", bodyOmitted: false });
		expect(res.body.code).toContain("https://api.example.com/users?page=2");
		expect(res.body.code).toContain("Content-Type: application/json");
		expect(res.body.code).toContain('{"name":"Ada"}');
		// A body makes cURL send POST without -X.
		expect(res.body.code).toMatch(/--data/);
	});

	it("speaks other targets, and leaves {{variables}} as written", async () => {
		const res = await snippet({
			target: "python-requests",
			request: {
				method: "GET",
				url: "https://{{host}}/items",
				headers: [{ name: "Authorization", value: "Bearer {{token}}" }],
			},
		});
		expect(res.status).toBe(200);
		expect(res.body.syntax).toBe("python");
		expect(res.body.code).toContain("{{host}}");
		expect(res.body.code).toContain("Bearer {{token}}");
	});

	it("leaves out a body that is not UTF-8 text", async () => {
		const res = await snippet({
			target: "javascript-fetch",
			request: {
				method: "POST",
				url: "https://api.example.com/upload",
				body: Buffer.from([0xff, 0xfe, 0x00]).toString("base64"),
				bodyType: "base64",
			},
		});
		expect(res.status).toBe(200);
		expect(res.body.bodyOmitted).toBe(true);
	});

	it("refuses an unknown target and a relative URL", async () => {
		const target = await snippet({ target: "cobol", request: POST_JSON });
		expect(target.status).toBe(400);
		const url = await snippet({
			target: "curl",
			request: { ...POST_JSON, url: "/users" },
		});
		expect(url.status).toBe(400);
	});
});
