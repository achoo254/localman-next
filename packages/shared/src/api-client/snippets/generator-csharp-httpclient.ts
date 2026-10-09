/**
 * C# `HttpClient`. Headers are added without validation (any name, any
 * value, repeats kept); `Content-*` headers go on the content.
 */
import { doubleQuotedC as cs } from "./snippet-escape.js";
import type { SnippetRequest } from "./snippet-input.js";

export function generateCsharpHttpClient(request: SnippetRequest): string {
	const { method, url, headers, body } = request;
	const isContent = (name: string): boolean => /^content-/i.test(name);
	const lines = [
		"using System.Net.Http.Headers;",
		"",
		"using var client = new HttpClient();",
		`using var request = new HttpRequestMessage(new HttpMethod(${cs(method)}), ${cs(url)});`,
	];
	for (const { name, value } of headers) {
		if (body !== null && isContent(name)) continue;
		lines.push(
			`request.Headers.TryAddWithoutValidation(${cs(name)}, ${cs(value)});`,
		);
	}
	if (body !== null) {
		lines.push(`request.Content = new StringContent(${cs(body)});`);
		const type = headers.find((h) => /^content-type$/i.test(h.name));
		lines.push(
			type
				? `request.Content.Headers.ContentType = MediaTypeHeaderValue.Parse(${cs(type.value)});`
				: "request.Content.Headers.ContentType = null;",
		);
		for (const { name, value } of headers) {
			if (!isContent(name) || /^content-type$/i.test(name)) continue;
			lines.push(
				`request.Content.Headers.TryAddWithoutValidation(${cs(name)}, ${cs(value)});`,
			);
		}
	}
	lines.push(
		"",
		"using var response = await client.SendAsync(request);",
		"Console.WriteLine(await response.Content.ReadAsStringAsync());",
	);
	return lines.join("\n");
}
