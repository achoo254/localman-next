/** Dart `package:http`. Strings escape `$`, which would interpolate. */
import { dartString as dart } from "./snippet-escape.js";
import { type SnippetRequest, block, mergedHeaders } from "./snippet-input.js";

export function generateDartHttp(request: SnippetRequest): string {
	const { method, url, headers, body } = request;
	const lines = [
		"import 'package:http/http.dart' as http;",
		"",
		"void main() async {",
		`  final request = http.Request(${dart(method)}, Uri.parse(${dart(url)}));`,
	];
	if (headers.length > 0) {
		const entries = mergedHeaders(headers).map(
			(h) => `${dart(h.name)}: ${dart(h.value)}`,
		);
		const map = block("request.headers.addAll({", entries, "});");
		lines.push(...map.split("\n").map((line) => `  ${line}`));
	}
	if (body !== null) lines.push(`  request.body = ${dart(body)};`);
	lines.push(
		"",
		"  final response = await http.Response.fromStream(await request.send());",
		"  print(response.body);",
		"}",
	);
	return lines.join("\n");
}
