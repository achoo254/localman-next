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
 * Raw bytes kept while a compressed body has not decoded a single byte
 * yet: enough to show a body whose `Content-Encoding` is wrong from the
 * start, without holding a second 10 MB buffer beside the decoded one.
 */
export const RAW_FALLBACK_BYTES = 64 * 1024;

/** Raw chunks kept while under `RAW_FALLBACK_BYTES`; `gap`: some dropped. */
class RawPrefix {
	readonly chunks: Buffer[] = [];
	private size = 0;
	gap = false;

	add(chunk: Buffer): void {
		if (this.gap || this.size >= RAW_FALLBACK_BYTES) {
			this.gap = true;
			return;
		}
		this.chunks.push(chunk);
		this.size += chunk.length;
	}
}

/**
 * Reads the response body, decompressed (gzip, deflate, br) with the cap
 * applied to the decompressed bytes, so a small compressed bomb cannot
 * fill memory. Past `limit` the rest is dropped and the socket closed.
 * Only one buffer grows at a time: the raw bytes are kept just until the
 * decoder produces output. A body that fails to decompress before any
 * output is returned raw (its `Content-Encoding` still visible in the
 * headers), in full up to `limit` when the failure came within about the
 * first `RAW_FALLBACK_BYTES`, else cut there and marked truncated; a
 * failure after some output returns that output marked truncated.
 */
export function readResponseBody(
	response: IncomingMessage,
	limit: number = MAX_RESPONSE_BODY_BYTES,
): Promise<ReadBody> {
	const decoder = decoderFor(response.headers["content-encoding"]);
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
			collectRaw(response, new CappedCollector(limit), finish);
			return;
		}
		const decoded = new CappedCollector(limit);
		let rawPrefix: RawPrefix | null = new RawPrefix();
		// Backpressure: the next chunk waits for the decoder, so a decoding
		// error shows up before the raw prefix outgrows its size.
		const onData = (chunk: Buffer): void => {
			rawPrefix?.add(chunk);
			if (!decoder.write(chunk)) {
				response.pause();
				decoder.once("drain", () => response.resume());
			}
		};
		response.on("data", onData);
		const onEnd = (): void => {
			decoder.end();
		};
		response.on("end", onEnd);
		decoder.on("data", (chunk: Buffer) => {
			rawPrefix = null;
			if (!decoded.add(chunk)) finish(decoded.result());
		});
		decoder.on("end", () => finish(decoded.result()));
		decoder.on("error", () => {
			const prefix = rawPrefix;
			if (!prefix) return finish({ ...decoded.result(), truncated: true });
			const raw = new CappedCollector(limit);
			for (const chunk of prefix.chunks) {
				if (!raw.add(chunk)) return finish(raw.result());
			}
			if (prefix.gap) return finish({ ...raw.result(), truncated: true });
			if (response.readableEnded) return finish(raw.result());
			// Every byte so far is kept: read the rest raw.
			response.off("data", onData);
			response.off("end", onEnd);
			collectRaw(response, raw, finish);
			response.resume();
		});
	});
}

/** Feeds the rest of `response` into `into`, finishing at the cap or end. */
function collectRaw(
	response: IncomingMessage,
	into: CappedCollector,
	finish: (body: ReadBody) => void,
): void {
	response.on("data", (chunk: Buffer) => {
		if (!into.add(chunk)) finish(into.result());
	});
	response.on("end", () => finish(into.result()));
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
