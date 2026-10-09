import { describe, expect, it } from "vitest";
import {
	base64DecodedLength,
	base64ToBytes,
	bytesToBase64,
	decodeUtf8OrNull,
	isBase64,
	utf8ByteLength,
	utf8Encode,
} from "./byte-encoding.js";

describe("byte encoding", () => {
	it.each(["", "f", "fo", "foo", "foob", "fooba", "foobar"])(
		"base64 round-trips %j like Node",
		(text) => {
			const bytes = utf8Encode(text);
			const encoded = bytesToBase64(bytes);
			expect(encoded).toBe(Buffer.from(text).toString("base64"));
			expect([...base64ToBytes(encoded)]).toEqual([...bytes]);
			expect(base64DecodedLength(encoded)).toBe(bytes.length);
		},
	);

	it("round-trips every byte value", () => {
		const bytes = Uint8Array.from({ length: 256 }, (_, i) => i);
		const encoded = bytesToBase64(bytes);
		expect(encoded).toBe(Buffer.from(bytes).toString("base64"));
		expect([...base64ToBytes(encoded)]).toEqual([...bytes]);
	});

	it("rejects non-canonical base64", () => {
		for (const bad of ["abc", "ab=c", "a b=", "Zm9v\n", "Zm9v===", "@@@@"]) {
			expect(isBase64(bad)).toBe(false);
			expect(() => base64ToBytes(bad)).toThrow();
		}
	});

	it("counts UTF-8 bytes without encoding", () => {
		for (const text of ["", "abc", "đạt", "密码", "😀", "a\uD800b"]) {
			expect(utf8ByteLength(text)).toBe(utf8Encode(text).length);
		}
	});

	it("decodes valid UTF-8 and refuses binary", () => {
		expect(decodeUtf8OrNull(utf8Encode("chào"))).toBe("chào");
		expect(decodeUtf8OrNull(new Uint8Array([0xff, 0xfe, 0x00]))).toBeNull();
	});
});
