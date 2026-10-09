/** Rust reqwest (async, tokio). `.header` appends, so repeats are kept. */
import { doubleQuotedBraces as rust } from "./snippet-escape.js";
import type { SnippetRequest } from "./snippet-input.js";

export function generateRustReqwest(request: SnippetRequest): string {
	const { method, url, headers, body } = request;
	const lines = [
		"#[tokio::main]",
		"async fn main() -> Result<(), reqwest::Error> {",
		"    let client = reqwest::Client::new();",
		"    let response = client",
		`        .request(reqwest::Method::${method}, ${rust(url)})`,
	];
	for (const { name, value } of headers) {
		lines.push(`        .header(${rust(name)}, ${rust(value)})`);
	}
	if (body !== null) lines.push(`        .body(${rust(body)})`);
	lines.push(
		"        .send()",
		"        .await?;",
		'    println!("{}", response.text().await?);',
		"    Ok(())",
		"}",
	);
	return lines.join("\n");
}
