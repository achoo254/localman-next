import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import {
	OWNER,
	createMockProject,
	useMockTestKit,
} from "../mock-runtime/testing/mock-test-kit.js";
import { InboxModel } from "./inbox-model.js";

const kit = useMockTestKit();

const inboxes = (id: string, suffix = "") => `/projects/${id}/inboxes${suffix}`;
const answering = (contentType: string) => ({
	name: "page",
	response: { status: 200, contentType, body: "<script>alert(1)</script>" },
});

describe("webhook inbox response", () => {
	it("answers JSON or plain text only", async () => {
		const { id } = await createMockProject();
		for (const type of [
			"text/html",
			"application/javascript",
			"image/svg+xml",
			"application/xml",
			"text/html; charset=utf-8",
		]) {
			const res = await as(OWNER).send("post", inboxes(id), answering(type));
			expect(res.status, type).toBe(400);
			expect(res.body.error.code).toBe("VALIDATION_ERROR");
		}
		const created = await as(OWNER).send(
			"post",
			inboxes(id),
			answering("text/plain; charset=utf-8"),
		);
		expect(created.status).toBe(201);
		const updated = await as(OWNER).send("put", inboxes(id, "/page"), {
			response: { contentType: "text/html" },
		});
		expect(updated.status).toBe(400);
	});

	it("serves a type stored before the limit as text/plain", async () => {
		const { id, secret } = await createMockProject();
		const created = await as(OWNER).send(
			"post",
			inboxes(id),
			answering("text/plain"),
		);
		expect(created.status).toBe(201);
		await InboxModel.updateOne(
			{ name: "page" },
			{ $set: { "response.contentType": "text/html" } },
		);
		const res = await kit.client(secret).get("/_inbox/page");
		expect(res.status).toBe(200);
		expect(res.headers["content-type"]).toMatch(/^text\/plain/);
		expect(res.headers["content-security-policy"]).toContain("sandbox");
		const list = await as(OWNER).get(inboxes(id));
		expect(list.body.items[0].response.contentType).toBe("text/plain");
	});

	it("caps inboxes per project by the owner's plan", async () => {
		const { id } = await createMockProject();
		for (const name of ["a", "b"]) {
			const res = await as(OWNER).send("post", inboxes(id), { name });
			expect(res.status).toBe(201);
		}
		const third = await as(OWNER).send("post", inboxes(id), { name: "c" });
		expect(third.status).toBe(403);
		expect(third.body.error).toMatchObject({
			code: "PLAN_LIMIT_REACHED",
			details: { limit: "webhookInboxes", max: 2, used: 2 },
		});
		const other = await createMockProject();
		const elsewhere = await as(OWNER).send("post", inboxes(other.id), {
			name: "a",
		});
		expect(elsewhere.status).toBe(201);
		const taken = await as(OWNER).send("post", inboxes(other.id), {
			name: "a",
		});
		expect(taken.status).toBe(409);
		expect(taken.body.error.code).toBe("INBOX_NAME_TAKEN");
	});
});
