/** Swift `URLSession` (async). `addValue` keeps repeated header names. */
import { doubleQuotedBraces as swift } from "./snippet-escape.js";
import type { SnippetRequest } from "./snippet-input.js";

export function generateSwiftUrlSession(request: SnippetRequest): string {
	const { method, url, headers, body } = request;
	const lines = [
		"import Foundation",
		"",
		`var request = URLRequest(url: URL(string: ${swift(url)})!)`,
		`request.httpMethod = ${swift(method)}`,
	];
	for (const { name, value } of headers) {
		lines.push(
			`request.addValue(${swift(value)}, forHTTPHeaderField: ${swift(name)})`,
		);
	}
	if (body !== null) lines.push(`request.httpBody = Data(${swift(body)}.utf8)`);
	lines.push(
		"",
		"let (data, _) = try await URLSession.shared.data(for: request)",
		"print(String(decoding: data, as: UTF8.self))",
	);
	return lines.join("\n");
}
