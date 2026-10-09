/** Java OkHttp 4. The Content-Type header becomes the body's media type. */
import { doubleQuotedC as java } from "./snippet-escape.js";
import {
	type SnippetRequest,
	headerValue,
	withoutHeader,
} from "./snippet-input.js";

/** OkHttp requires a body for these methods, even an empty one. */
const NEEDS_BODY = new Set(["POST", "PUT", "PATCH"]);

export function generateJavaOkHttp(request: SnippetRequest): string {
	const { method, url, body } = request;
	const lines = ["OkHttpClient client = new OkHttpClient();", ""];
	let headers = request.headers;
	let bodyArg = "null";
	if (body !== null) {
		const type = headerValue(headers, "content-type");
		headers = withoutHeader(headers, "content-type");
		lines.push(
			`MediaType mediaType = ${type === null ? "null" : `MediaType.parse(${java(type)})`};`,
			`RequestBody body = RequestBody.create(${java(body)}, mediaType);`,
		);
		bodyArg = "body";
	} else if (NEEDS_BODY.has(method)) {
		bodyArg = "RequestBody.create(new byte[0], null)";
	}
	lines.push(
		"Request request = new Request.Builder()",
		`    .url(${java(url)})`,
	);
	if (method === "HEAD") lines.push("    .head()");
	else if (method !== "GET") {
		lines.push(`    .method(${java(method)}, ${bodyArg})`);
	}
	for (const { name, value } of headers) {
		lines.push(`    .addHeader(${java(name)}, ${java(value)})`);
	}
	lines.push(
		"    .build();",
		"",
		"try (Response response = client.newCall(request).execute()) {",
		"    System.out.println(response.body().string());",
		"}",
	);
	return lines.join("\n");
}
