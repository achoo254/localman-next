/** Ruby `Net::HTTP`. Double-quoted strings with Ruby escapes; `add_field` keeps repeats. */
import { rubyString as rb } from "./snippet-escape.js";
import type { SnippetRequest } from "./snippet-input.js";

export function generateRubyNetHttp(request: SnippetRequest): string {
	const { method, url, headers, body } = request;
	const className = method.charAt(0) + method.slice(1).toLowerCase();
	const lines = [
		"require 'net/http'",
		"require 'uri'",
		"",
		`uri = URI(${rb(url)})`,
		`request = Net::HTTP::${className}.new(uri)`,
	];
	for (const { name, value } of headers) {
		lines.push(`request.add_field(${rb(name)}, ${rb(value)})`);
	}
	if (body !== null) lines.push(`request.body = ${rb(body)}`);
	lines.push(
		"",
		"response = Net::HTTP.start(uri.hostname, uri.port, use_ssl: uri.scheme == 'https') do |http|",
		"  http.request(request)",
		"end",
		"puts response.body",
	);
	return lines.join("\n");
}
