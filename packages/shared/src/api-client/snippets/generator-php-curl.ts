/** PHP cURL extension. */
import { phpString as php } from "./snippet-escape.js";
import { type SnippetRequest, block } from "./snippet-input.js";

export function generatePhpCurl(request: SnippetRequest): string {
	const { method, url, headers, body } = request;
	const lines = [
		"<?php",
		"$ch = curl_init();",
		`curl_setopt($ch, CURLOPT_URL, ${php(url)});`,
		"curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);",
	];
	if (method === "HEAD") lines.push("curl_setopt($ch, CURLOPT_NOBODY, true);");
	else if (method !== "GET") {
		lines.push(`curl_setopt($ch, CURLOPT_CUSTOMREQUEST, ${php(method)});`);
	}
	if (headers.length > 0) {
		// `Name:` would remove the header; `Name;` sends it empty.
		const items = headers.map(({ name, value }) =>
			php(value === "" ? `${name};` : `${name}: ${value}`),
		);
		lines.push(
			block("curl_setopt($ch, CURLOPT_HTTPHEADER, [", items, "]);", "    "),
		);
	}
	if (body !== null)
		lines.push(`curl_setopt($ch, CURLOPT_POSTFIELDS, ${php(body)});`);
	lines.push(
		"",
		"$response = curl_exec($ch);",
		"curl_close($ch);",
		"echo $response;",
	);
	return lines.join("\n");
}
