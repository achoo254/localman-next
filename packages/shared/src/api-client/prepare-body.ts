/**
 * Body of a prepared request: the active body kind with variables filled
 * in, as text or bytes, plus the Content-Type it implies.
 */
import { utf8ByteLength } from "./byte-encoding.js";
import { MAX_REQUEST_BODY_BYTES } from "./limits.js";
import {
	type MultipartPart,
	encodeMultipart,
	multipartContentType,
} from "./multipart-encoder.js";
import { RequestPrepareError } from "./prepare-error.js";
import type {
	FileRef,
	HttpMethod,
	RawLanguage,
	RequestBody,
} from "./request-model.js";

export type PreparedBody =
	| { kind: "none" }
	| { kind: "text"; text: string }
	| { kind: "bytes"; bytes: Uint8Array };

export interface BuiltBody {
	body: PreparedBody;
	/** Content-Type to add when the user did not set one. */
	contentType: string | null;
}

export interface BodyInputs {
	fill: (text: string) => string;
	/** Bytes of picked files by `FileRef.fileId`. */
	files: ReadonlyMap<string, Uint8Array>;
	boundary: string;
}

/** `fetch` rejects a body on these; every other method may carry one. */
const NO_BODY_METHODS: ReadonlySet<HttpMethod> = new Set(["GET", "HEAD"]);

const RAW_CONTENT_TYPES: Readonly<Record<RawLanguage, string>> = {
	json: "application/json",
	text: "text/plain",
	xml: "application/xml",
	html: "text/html",
	javascript: "application/javascript",
};

const NO_BODY: BuiltBody = { body: { kind: "none" }, contentType: null };

function fileBytes(
	file: FileRef,
	files: ReadonlyMap<string, Uint8Array>,
): Uint8Array {
	const bytes = files.get(file.fileId);
	if (!bytes) throw new RequestPrepareError("FILE_MISSING", file.name);
	return bytes;
}

function buildUnchecked(body: RequestBody, inputs: BodyInputs): BuiltBody {
	const { fill, files } = inputs;
	switch (body.type) {
		case "none":
			return NO_BODY;
		case "raw": {
			const text = fill(body.raw);
			if (!text.trim()) return NO_BODY;
			const contentType = RAW_CONTENT_TYPES[body.rawLanguage];
			return { body: { kind: "text", text }, contentType };
		}
		case "urlencoded": {
			const text = body.urlencoded
				.filter((row) => row.enabled && row.key.trim())
				.map(
					(row) =>
						`${encodeURIComponent(fill(row.key.trim()))}=${encodeURIComponent(fill(row.value))}`,
				)
				.join("&");
			if (!text) return NO_BODY;
			const contentType = "application/x-www-form-urlencoded";
			return { body: { kind: "text", text }, contentType };
		}
		case "formdata": {
			const parts: MultipartPart[] = [];
			for (const row of body.formData) {
				if (!row.enabled || !row.key.trim()) continue;
				const name = fill(row.key.trim());
				if (row.kind === "text") {
					parts.push({ kind: "text", name, value: fill(row.value) });
				} else if (row.file) {
					const { name: fileName, contentType } = row.file;
					const bytes = fileBytes(row.file, files);
					parts.push({ kind: "file", name, fileName, contentType, bytes });
				}
			}
			if (parts.length === 0) return NO_BODY;
			const bytes = encodeMultipart(parts, inputs.boundary);
			const contentType = multipartContentType(inputs.boundary);
			return { body: { kind: "bytes", bytes }, contentType };
		}
		case "binary": {
			if (!body.binary) return NO_BODY;
			const bytes = fileBytes(body.binary, files);
			const contentType = body.binary.contentType || "application/octet-stream";
			return { body: { kind: "bytes", bytes }, contentType };
		}
	}
}

export function preparedBodyBytes(body: PreparedBody): number {
	if (body.kind === "none") return 0;
	return body.kind === "text" ? utf8ByteLength(body.text) : body.bytes.length;
}

/** Throws `BODY_TOO_LARGE` past `MAX_REQUEST_BODY_BYTES`. */
export function buildPreparedBody(
	method: HttpMethod,
	body: RequestBody,
	inputs: BodyInputs,
): BuiltBody {
	if (NO_BODY_METHODS.has(method)) return NO_BODY;
	const built = buildUnchecked(body, inputs);
	if (preparedBodyBytes(built.body) > MAX_REQUEST_BODY_BYTES) {
		throw new RequestPrepareError("BODY_TOO_LARGE");
	}
	return built;
}
