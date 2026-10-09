import type { IncomingMessage } from "node:http";
import type { Transform } from "node:stream";
import { createBrotliDecompress, createUnzip } from "node:zlib";
import {
	type BodyEncoding,
	MAX_RESPONSE_BODY_BYTES,
	decodeUtf8OrNull,
} from "@localman/shared/api-client";

export interface ReadBody {
	readonly bytes: Buffer;
	/** More than `limit` bytes (after decompression) were available. */
	readonly truncated: boolean;
}

/** Decoder for a single `Content-Encoding`; `null` keeps the raw bytes. */
function decoderFor(contentEncoding: string | undefined): Transform | null {
	const encoding = contentEncoding?.trim().toLowerCase();
	if (encoding === "gzip" || encoding === "x-gzip" || encoding === "deflate") {
		// Unzip reads both gzip and zlib framing.
		return createUnzip();
	}
	if (encoding === "br") return createBrotliDecompress();
	return null;
}

/** Collects up to `limit` bytes of a stream, then reports the cut. */
class CappedCollector {
	private readonly chunks: Buffer[] = [];
	private size = 0;
	truncated = false;

	constructor(private readonly limit: number) {}

	/** False once the limit is reached: stop reading. */
	add(chunk: Buffer): boolean {
		const room = this.limit - this.size;
		if (chunk.length > room) {
			this.chunks.push(chunk.subarray(0, room));
			this.size = this.limit;
			this.truncated = true;
			return false;
		}
		this.chunks.push(chunk);
		this.size += chunk.length;
		return true;
	}

	result(): ReadBody {
		return { bytes: Buffer.concat(this.chunks), truncated: this.truncated };
	}
}

/**
 * Reads the response body, decompressed (gzip, deflate, br) with the cap
 * applied to the decompressed bytes, so a small compressed bomb cannot
 * fill memory. Past `limit` the rest is dropped and the socket closed.
 * A body that fails to decompress is returned raw (also capped), its
 * `Content-Encoding` still visible in the headers.
 */
export function readResponseBody(
	response: IncomingMessage,
	limit: number = MAX_RESPONSE_BODY_BYTES,
): Promise<ReadBody> {
	const decoder = decoderFor(response.headers["content-encoding"]);
	const raw = new CappedCollector(limit);
	const decoded = new CappedCollector(limit);
	return new Promise((resolve, reject) => {
		let settled = false;
		const finish = (body: ReadBody): void => {
			if (settled) return;
			settled = true;
			decoder?.destroy();
			if (!response.complete) response.destroy();
			resolve(body);
		};
		const fail = (error: Error): void => {
			if (settled) return;
			settled = true;
			decoder?.destroy();
			reject(error);
		};
		response.on("error", fail);
		// Socket closed before the end (deadline, reset): not a full body.
		response.on("close", () => {
			if (!response.complete) fail(new Error("Response aborted"));
		});
		if (!decoder) {
			response.on("data", (chunk: Buffer) => {
				if (!raw.add(chunk)) finish(raw.result());
			});
			response.on("end", () => finish(raw.result()));
			return;
		}
		response.on("data", (chunk: Buffer) => {
			raw.add(chunk);
			decoder.write(chunk);
		});
		response.on("end", () => decoder.end());
		decoder.on("data", (chunk: Buffer) => {
			if (!decoded.add(chunk)) finish(decoded.result());
		});
		decoder.on("end", () => finish(decoded.result()));
		decoder.on("error", () => finish(raw.result()));
	});
}

export interface EncodedBody {
	readonly body: string;
	readonly bodyEncoding: BodyEncoding;
	readonly size: number;
}

/**
 * UTF-8 text when the bytes decode, else base64. A body cut mid-character
 * loses that last partial character instead of turning into base64.
 */
export function encodeBody(bytes: Buffer, truncated: boolean): EncodedBody {
	const text = decodeUtf8OrNull(bytes);
	if (text !== null) {
		return { body: text, bodyEncoding: "utf8", size: bytes.length };
	}
	if (truncated) {
		for (let cut = 1; cut <= 3 && cut < bytes.length; cut++) {
			const trimmed = bytes.subarray(0, bytes.length - cut);
			const partial = decodeUtf8OrNull(trimmed);
			if (partial !== null) {
				return { body: partial, bodyEncoding: "utf8", size: trimmed.length };
			}
		}
	}
	return {
		body: bytes.toString("base64"),
		bodyEncoding: "base64",
		size: bytes.length,
	};
}
