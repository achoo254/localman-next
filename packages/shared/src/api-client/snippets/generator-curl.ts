/** cURL. The body goes in `--data-raw`, so a body starting with `@` is never read as a file. */
import { shellQuote } from "./snippet-escape.js";
import type { SnippetRequest } from "./snippet-input.js";

/** curl treats `[]{}` in a URL as a glob unless told not to. */
const GLOB = /[[\]{}]/;

export function generateCurl(request: SnippetRequest): string {
	const { method, url, headers, body } = request;
	const first = ["curl"];
	if (GLOB.test(url)) first.push("-g");
	if (method === "HEAD") first.push("-I");
	else if (
		!(method === "GET" && body === null) &&
		!(method === "POST" && body !== null)
	) {
		first.push(`-X ${method}`);
	}
	first.push(shellQuote(url));
	const parts = [first.join(" ")];
	for (const { name, value } of headers) {
		// `Name:` would remove the header; `Name;` sends it empty.
		parts.push(
			`-H ${shellQuote(value === "" ? `${name};` : `${name}: ${value}`)}`,
		);
	}
	if (body !== null) parts.push(`--data-raw ${shellQuote(body)}`);
	return parts.join(" \\\n  ");
}
