/** Kotlin OkHttp 4. Strings escape `$`, which would start a template. */
import { kotlinString as kt } from "./snippet-escape.js";
import {
	type SnippetRequest,
	headerValue,
	withoutHeader,
} from "./snippet-input.js";

const NEEDS_BODY = new Set(["POST", "PUT", "PATCH"]);

export function generateKotlinOkHttp(request: SnippetRequest): string {
	const { method, url, body } = request;
	const lines = ["val client = OkHttpClient()", ""];
	let headers = request.headers;
	let bodyArg = "null";
	if (body !== null) {
		const type = headerValue(headers, "content-type");
		headers = withoutHeader(headers, "content-type");
		const media = type === null ? "" : `${kt(type)}.toMediaType()`;
		lines.push(`val body = ${kt(body)}.toRequestBody(${media})`);
		bodyArg = "body";
	} else if (NEEDS_BODY.has(method)) {
		bodyArg = "ByteArray(0).toRequestBody()";
	}
	lines.push("val request = Request.Builder()", `    .url(${kt(url)})`);
	if (method === "HEAD") lines.push("    .head()");
	else if (method !== "GET") {
		lines.push(`    .method(${kt(method)}, ${bodyArg})`);
	}
	for (const { name, value } of headers) {
		lines.push(`    .addHeader(${kt(name)}, ${kt(value)})`);
	}
	lines.push(
		"    .build()",
		"",
		"client.newCall(request).execute().use { response ->",
		"    println(response.body?.string())",
		"}",
	);
	return lines.join("\n");
}
