import { describe, expect, it } from "vitest";
import { MAX_REQUEST_BODY_BYTES } from "./limits.js";
import { RequestPrepareError } from "./prepare-error.js";
import {
	baseRequest,
	body,
	bodyText,
	row,
	secretOptions,
} from "./request-preparer-test-utils.js";
import { prepareRequest } from "./request-preparer.js";

describe("request preparer: body and errors", () => {
	it("encodes url-encoded rows with variables", () => {
		const out = prepareRequest(
			baseRequest({
				method: "PATCH",
				body: body({
					type: "urlencoded",
					urlencoded: [row("status", "a b&c"), row("off", "1", false)],
				}),
			}),
		);
		expect(bodyText(out)).toBe("status=a%20b%26c");
		expect(out.headers).toContainEqual({
			name: "Content-Type",
			value: "application/x-www-form-urlencoded",
		});
	});

	it("builds multipart form-data with text and file rows", () => {
		const out = prepareRequest(
			baseRequest({
				method: "POST",
				body: body({
					type: "formdata",
					formData: [
						{ ...row("note", "{{token}}"), kind: "text" },
						{
							...row("doc", ""),
							kind: "file",
							file: {
								fileId: "f1",
								name: "a.txt",
								contentType: "text/plain",
								size: 2,
							},
						},
					],
				}),
			}),
			{
				...secretOptions,
				boundary: "B",
				files: new Map([["f1", new Uint8Array([104, 105])]]),
			},
		);
		expect(bodyText(out)).toBe(
			'--B\r\nContent-Disposition: form-data; name="note"\r\n\r\ns3cret\r\n' +
				'--B\r\nContent-Disposition: form-data; name="doc"; filename="a.txt"\r\nContent-Type: text/plain\r\n\r\nhi\r\n--B--\r\n',
		);
		expect(out.headers).toContainEqual({
			name: "Content-Type",
			value: "multipart/form-data; boundary=B",
		});
		expect(out.secretsUsed).toEqual(["token"]);
	});

	it("sends binary bytes as is", () => {
		const bytes = new Uint8Array([0, 255, 10]);
		const out = prepareRequest(
			baseRequest({
				method: "PUT",
				body: body({
					type: "binary",
					binary: { fileId: "b", name: "x.bin", contentType: "", size: 3 },
				}),
			}),
			{ files: new Map([["b", bytes]]) },
		);
		expect(out.body).toEqual({ kind: "bytes", bytes });
		expect(out.headers).toContainEqual({
			name: "Content-Type",
			value: "application/octet-stream",
		});
	});

	it("keeps a Content-Type the user set", () => {
		const out = prepareRequest(
			baseRequest({
				method: "POST",
				headers: [row("content-type", "application/vnd.api+json")],
				body: body({ type: "raw", raw: "{}" }),
			}),
		);
		expect(out.headers).toEqual([
			{ name: "content-type", value: "application/vnd.api+json" },
		]);
	});

	it("sends no body for GET and HEAD, nor for a blank raw body", () => {
		const raw = body({ type: "raw", raw: "{}" });
		expect(
			prepareRequest(baseRequest({ method: "GET", body: raw })).body.kind,
		).toBe("none");
		expect(
			prepareRequest(baseRequest({ method: "HEAD", body: raw })).body.kind,
		).toBe("none");
		expect(
			prepareRequest(baseRequest({ method: "DELETE", body: raw })).body.kind,
		).toBe("text");
		const blank = body({ type: "raw", raw: "  \n" });
		const out = prepareRequest(baseRequest({ method: "POST", body: blank }));
		expect(out.body.kind).toBe("none");
		expect(out.headers).toEqual([]);
	});

	it.each([
		[{ url: "{{baseUrl}}/a" }, "INVALID_URL"],
		[{ url: "https://{{tenant}}.x.test/a" }, "INVALID_URL"],
		[{ url: "ftp://x.test" }, "INVALID_URL"],
		[{ headers: [row("Bad Name", "1")] }, "INVALID_HEADER_NAME"],
		[{ headers: [row("X-A", "1\r\nX-Evil: 2")] }, "INVALID_HEADER_VALUE"],
		[
			{
				method: "POST" as const,
				body: body({
					type: "binary",
					binary: { fileId: "gone", name: "x", contentType: "", size: 1 },
				}),
			},
			"FILE_MISSING",
		],
		[
			{
				method: "POST" as const,
				body: body({
					type: "raw",
					raw: "x".repeat(MAX_REQUEST_BODY_BYTES + 1),
				}),
			},
			"BODY_TOO_LARGE",
		],
	])("rejects %#", (overrides, code) => {
		const run = () => prepareRequest(baseRequest(overrides));
		expect(run).toThrow(RequestPrepareError);
		expect(run).toThrow(expect.objectContaining({ code }));
	});
});
