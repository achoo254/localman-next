/** Python requests. A non-ASCII body is encoded to UTF-8 (a `str` body is sent as Latin-1). */
import { singleQuotedC as py } from "./snippet-escape.js";
import {
	type SnippetRequest,
	block,
	isAscii,
	mergedHeaders,
} from "./snippet-input.js";

export function generatePythonRequests(request: SnippetRequest): string {
	const { method, url, headers, body } = request;
	const args = [py(method), py(url)];
	if (headers.length > 0) {
		const entries = mergedHeaders(headers).map(
			(h) => `${py(h.name)}: ${py(h.value)}`,
		);
		args.push(block("headers={", entries, "}", "    "));
	}
	if (body !== null) {
		args.push(`data=${py(body)}${isAscii(body) ? "" : ".encode('utf-8')"}`);
	}
	return [
		"import requests",
		"",
		block("response = requests.request(", args, ")", "    "),
		"print(response.text)",
	].join("\n");
}
