/** HTTPie. The body is piped with `printf '%s'`, which never reads `\` escapes. */
import { shellQuote } from "./snippet-escape.js";
import type { SnippetRequest } from "./snippet-input.js";

export function generateHttpie(request: SnippetRequest): string {
	const { method, url, headers, body } = request;
	const parts = [`http ${method} ${shellQuote(url)}`];
	for (const { name, value } of headers) {
		// `Name:` would remove the header; `Name;` sends it empty.
		parts.push(shellQuote(value === "" ? `${name};` : `${name}:${value}`));
	}
	const command = parts.join(" \\\n  ");
	return body === null
		? command
		: `printf '%s' ${shellQuote(body)} | ${command}`;
}
