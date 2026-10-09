import { describe, expect, it } from "vitest";
import {
	createMultipartBoundary,
	encodeMultipart,
	multipartContentType,
} from "./multipart-encoder.js";

const decode = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);

describe("multipart encoder", () => {
	it("encodes text and file parts per RFC 7578", () => {
		const bytes = encodeMultipart(
			[
				{ kind: "text", name: "note", value: "xin chào" },
				{
					kind: "file",
					name: "avatar",
					fileName: "a.png",
					contentType: "image/png",
					bytes: new Uint8Array([0x89, 0x50]),
				},
			],
			"B",
		);
		const head =
			'--B\r\nContent-Disposition: form-data; name="note"\r\n\r\nxin chào\r\n' +
			'--B\r\nContent-Disposition: form-data; name="avatar"; filename="a.png"\r\nContent-Type: image/png\r\n\r\n';
		const headBytes = new TextEncoder().encode(head);
		expect([...bytes.slice(0, headBytes.length)]).toEqual([...headBytes]);
		expect([...bytes.slice(headBytes.length, headBytes.length + 2)]).toEqual([
			0x89, 0x50,
		]);
		expect(decode(bytes.slice(headBytes.length + 2))).toBe("\r\n--B--\r\n");
	});

	it("escapes quotes and line breaks in names", () => {
		const text = decode(
			encodeMultipart(
				[
					{
						kind: "file",
						name: 'a"\r\nb',
						fileName: 'x".txt',
						contentType: "text/plain\r\nX-Evil: 1",
						bytes: new Uint8Array(),
					},
				],
				"B",
			),
		);
		expect(text).toContain('name="a%22%0D%0Ab"; filename="x%22.txt"');
		expect(text).toContain("Content-Type: text/plainX-Evil: 1\r\n");
		expect(text.split("\r\n").filter((l) => l.startsWith("X-Evil"))).toEqual(
			[],
		);
	});

	it("defaults the content type of a file", () => {
		const text = decode(
			encodeMultipart(
				[
					{
						kind: "file",
						name: "f",
						fileName: "f",
						contentType: "",
						bytes: new Uint8Array(),
					},
				],
				"B",
			),
		);
		expect(text).toContain("Content-Type: application/octet-stream");
	});

	it("encodes no parts as the closing boundary only", () => {
		expect(decode(encodeMultipart([], "B"))).toBe("--B--\r\n");
	});

	it("creates random boundaries safe for the header", () => {
		const a = createMultipartBoundary();
		expect(a).toMatch(/^----LocalmanFormBoundary[0-9A-Za-z]{24}$/);
		expect(createMultipartBoundary()).not.toBe(a);
		expect(multipartContentType(a)).toBe(`multipart/form-data; boundary=${a}`);
	});
});
