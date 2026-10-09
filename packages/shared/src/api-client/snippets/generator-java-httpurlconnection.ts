/** Java `HttpURLConnection`. `addRequestProperty` keeps repeated header names. */
import { doubleQuotedC as java } from "./snippet-escape.js";
import type { SnippetRequest } from "./snippet-input.js";

export function generateJavaHttpUrlConnection(request: SnippetRequest): string {
	const { method, url, headers, body } = request;
	const lines = [
		"import java.io.InputStream;",
		"import java.io.OutputStream;",
		"import java.net.HttpURLConnection;",
		"import java.net.URL;",
		"import java.nio.charset.StandardCharsets;",
		"",
		`URL url = new URL(${java(url)});`,
		"HttpURLConnection con = (HttpURLConnection) url.openConnection();",
	];
	if (method === "PATCH") {
		lines.push(
			"// HttpURLConnection rejects PATCH; use java.net.http.HttpClient for it.",
		);
	}
	lines.push(`con.setRequestMethod(${java(method)});`);
	for (const { name, value } of headers) {
		lines.push(`con.addRequestProperty(${java(name)}, ${java(value)});`);
	}
	if (body !== null) {
		lines.push(
			"con.setDoOutput(true);",
			"try (OutputStream os = con.getOutputStream()) {",
			`    os.write(${java(body)}.getBytes(StandardCharsets.UTF_8));`,
			"}",
		);
	}
	lines.push(
		"",
		"int status = con.getResponseCode();",
		"InputStream stream = status < 400 ? con.getInputStream() : con.getErrorStream();",
		'String response = stream == null ? "" : new String(stream.readAllBytes(), StandardCharsets.UTF_8);',
		'System.out.println(status + " " + response);',
	);
	return lines.join("\n");
}
