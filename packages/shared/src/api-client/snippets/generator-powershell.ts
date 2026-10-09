/**
 * PowerShell `Invoke-RestMethod`. Every string is single-quoted, so `$`
 * and backticks stay literal; Content-Type goes to `-ContentType` (it is
 * refused in `-Headers`); a non-ASCII body is sent as UTF-8 bytes.
 */
import { powershellString as ps } from "./snippet-escape.js";
import {
	type SnippetRequest,
	headerValue,
	isAscii,
	mergedHeaders,
	withoutHeader,
} from "./snippet-input.js";

export function generatePowershell(request: SnippetRequest): string {
	const { method, url, body } = request;
	const headers = mergedHeaders(withoutHeader(request.headers, "content-type"));
	const contentType = headerValue(request.headers, "content-type");
	// Built line by line: a body may hold line breaks, which must not be indented.
	const lines = [
		"$params = @{",
		`    Uri = ${ps(url)}`,
		`    Method = ${ps(method)}`,
	];
	if (headers.length > 0) {
		lines.push("    Headers = @{");
		for (const h of headers)
			lines.push(`        ${ps(h.name)} = ${ps(h.value)}`);
		lines.push("    }");
	}
	if (contentType !== null) lines.push(`    ContentType = ${ps(contentType)}`);
	if (body !== null) {
		lines.push(
			isAscii(body)
				? `    Body = ${ps(body)}`
				: `    Body = [System.Text.Encoding]::UTF8.GetBytes(${ps(body)})`,
		);
	}
	lines.push("}", "Invoke-RestMethod @params");
	return lines.join("\n");
}
