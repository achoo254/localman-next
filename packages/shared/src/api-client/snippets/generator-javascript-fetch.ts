/** JavaScript `fetch`. */
import { singleQuotedC as js } from "./snippet-escape.js";
import { type SnippetRequest, block, mergedHeaders } from "./snippet-input.js";

export function generateJavascriptFetch(request: SnippetRequest): string {
	const { method, url, headers, body } = request;
	const options: string[] = [];
	if (method !== "GET") options.push(`method: ${js(method)}`);
	if (headers.length > 0) {
		const entries = mergedHeaders(headers).map(
			(h) => `${js(h.name)}: ${js(h.value)}`,
		);
		options.push(block("headers: {", entries, "}"));
	}
	if (body !== null) options.push(`body: ${js(body)}`);
	const call =
		options.length === 0
			? `await fetch(${js(url)});`
			: `await fetch(${js(url)}, ${block("{", options, "});")}`;
	return [
		`const response = ${call}`,
		"console.log(await response.text());",
	].join("\n");
}
