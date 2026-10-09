/** JavaScript axios. */
import { singleQuotedC as js } from "./snippet-escape.js";
import { type SnippetRequest, block, mergedHeaders } from "./snippet-input.js";

export function generateJavascriptAxios(request: SnippetRequest): string {
	const { method, url, headers, body } = request;
	const config = [`method: ${js(method.toLowerCase())}`, `url: ${js(url)}`];
	if (headers.length > 0) {
		const entries = mergedHeaders(headers).map(
			(h) => `${js(h.name)}: ${js(h.value)}`,
		);
		config.push(block("headers: {", entries, "}"));
	}
	if (body !== null) config.push(`data: ${js(body)}`);
	return [
		"import axios from 'axios';",
		"",
		`const response = await axios(${block("{", config, "});")}`,
		"console.log(response.data);",
	].join("\n");
}
