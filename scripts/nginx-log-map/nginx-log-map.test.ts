/**
 * The access-log map of infra/localman/nginx/localman-http.conf, run the
 * way nginx runs it (first matching regex wins, named captures fill
 * `$name`), so a new secret-bearing path cannot reach the log unmasked.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const CONF = fileURLToPath(
	new URL("../../infra/localman/nginx/localman-http.conf", import.meta.url),
);

interface MapEntry {
	readonly pattern: RegExp;
	readonly replacement: string;
}

function logMap(): MapEntry[] {
	const text = readFileSync(CONF, "utf8");
	const body = /map \$request_uri \$localman_logged_uri \{([\s\S]*?)\n\}/.exec(
		text,
	)?.[1];
	if (!body) throw new Error("no $localman_logged_uri map");
	const entries: MapEntry[] = [];
	for (const line of body.split("\n")) {
		// `~` is case-sensitive, `~*` is not.
		const match = /^\s*"~(\*?)([^"]+)"\s+"([^"]*)";/.exec(line);
		if (match?.[2] !== undefined && match[3] !== undefined) {
			const flags = match[1] === "*" ? "i" : "";
			entries.push({
				pattern: new RegExp(match[2], flags),
				replacement: match[3],
			});
		}
	}
	return entries;
}

function logged(uri: string): string {
	for (const { pattern, replacement } of logMap()) {
		const match = pattern.exec(uri);
		if (!match) continue;
		return replacement.replace(
			/\$([a-z_]+)/g,
			(_, name: string) => match.groups?.[name] ?? "",
		);
	}
	return uri;
}

describe("access log map", () => {
	it.each([
		["/public/c/AbC123_-xyz", "/public/c/[redacted]"],
		["/guest/AbC123_-xyz", "/guest/[redacted]"],
		["/run/AbC123", "/run/[redacted]"],
		["/api/v1/public/links/AbC123", "/api/v1/public/links/[redacted]"],
		[
			"/api/v1/public/collections/64f0?access_key=lmck_secret",
			"/api/v1/public/collections/[redacted]",
		],
		["/m/s3cr3t/users", "/m/[secret]/users"],
		["/invite/tok", "/invite/[redacted]"],
		["/auth/callback?code=x", "/auth/callback?[redacted]"],
		["/api/v1/collections/1", "/api/v1/collections/1"],
		// Express and the web router ignore case; so does the mask.
		["/PUBLIC/C/AbC123", "/PUBLIC/C/[redacted]"],
		["/api/v1/Public/Links/AbC123", "/api/v1/Public/Links/[redacted]"],
	])("logs %s as %s", (uri, expected) => {
		expect(logged(uri)).toBe(expected);
	});
});
