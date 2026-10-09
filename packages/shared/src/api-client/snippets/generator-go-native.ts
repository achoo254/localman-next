/** Go `net/http`. `Header.Add` keeps repeated header names. */
import { doubleQuotedC as go } from "./snippet-escape.js";
import type { SnippetRequest } from "./snippet-input.js";

export function generateGoNative(request: SnippetRequest): string {
	const { method, url, headers, body } = request;
	const imports = ['"fmt"', '"io"', '"net/http"'];
	if (body !== null) imports.push('"strings"');
	const lines = [
		"package main",
		"",
		"import (",
		...imports.map((i) => `\t${i}`),
		")",
		"",
		"func main() {",
	];
	if (body !== null) lines.push(`\tbody := strings.NewReader(${go(body)})`);
	lines.push(
		`\treq, err := http.NewRequest(${go(method)}, ${go(url)}, ${body === null ? "nil" : "body"})`,
		"\tif err != nil {",
		"\t\tpanic(err)",
		"\t}",
	);
	for (const { name, value } of headers) {
		lines.push(`\treq.Header.Add(${go(name)}, ${go(value)})`);
	}
	lines.push(
		"",
		"\tresp, err := http.DefaultClient.Do(req)",
		"\tif err != nil {",
		"\t\tpanic(err)",
		"\t}",
		"\tdefer resp.Body.Close()",
		"",
		"\tdata, err := io.ReadAll(resp.Body)",
		"\tif err != nil {",
		"\t\tpanic(err)",
		"\t}",
		"\tfmt.Println(string(data))",
		"}",
	);
	return lines.join("\n");
}
