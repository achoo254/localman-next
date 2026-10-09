import {
	createRequestDraft,
	emptyRequestBody,
} from "@localman/shared/api-client";
import { describe, expect, it } from "vitest";
import { autoHeaders } from "./auto-headers";

const names = (draft: Parameters<typeof autoHeaders>[0]) =>
	autoHeaders(draft).map(({ name, value, source }) => [name, value, source]);

describe("autoHeaders", () => {
	it("lists Host, auth, body type and the proxy's headers", () => {
		const draft = createRequestDraft({
			method: "POST",
			url: "api.test:8080/users",
			auth: { type: "bearer", token: "{{token}}" },
			body: { ...emptyRequestBody(), type: "raw", raw: "{}" },
		});
		expect(names(draft)).toEqual([
			["Host", "api.test:8080", "url"],
			["Authorization", "Bearer {{token}}", "auth"],
			["Content-Type", "application/json", "body"],
			["X-Localman-Proxy", "1", "proxy"],
			["X-Forwarded-For", "<client-ip>", "clientIp"],
			["X-Real-IP", "<client-ip>", "clientIp"],
			["Forwarded", "for=<client-ip>;proto=http", "clientIp"],
		]);
	});

	it("skips Content-Type typed by the user, client IP when off, Host for a bad URL", () => {
		const draft = createRequestDraft({
			method: "PUT",
			url: "{{baseUrl}}/x",
			headers: [
				{ id: "h", key: "content-type", value: "text/csv", enabled: true },
			],
			body: { ...emptyRequestBody(), type: "raw", raw: "a,b" },
			auth: { type: "apikey", key: "X-Key", value: "k", in: "query" },
		});
		draft.settings.sendClientIp = false;
		expect(names(draft)).toEqual([["X-Localman-Proxy", "1", "proxy"]]);
	});

	it("shows a placeholder boundary for form-data with a file", () => {
		const draft = createRequestDraft({
			method: "POST",
			url: "https://a.test",
			body: {
				...emptyRequestBody(),
				type: "formdata",
				formData: [
					{
						id: "r",
						key: "f",
						value: "",
						enabled: true,
						kind: "file",
						file: {
							fileId: "f1",
							name: "a.png",
							contentType: "image/png",
							size: 3,
						},
					},
				],
			},
		});
		expect(names(draft)).toContainEqual([
			"Content-Type",
			"multipart/form-data; boundary=…",
			"body",
		]);
	});
});
