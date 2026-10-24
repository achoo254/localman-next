// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { TELEMETRY_SERVICES } from "@localman/shared/data-policy";
import { describe, expect, it } from "vitest";

/**
 * Analytics, tracking and error reporting services: their package names in
 * a string (an import or a script URL), their script hosts, and beacons.
 */
const TELEMETRY =
	/["'`/](@sentry\/|posthog|plausible|umami|mixpanel|amplitude|@segment\/|hotjar|logrocket|fullstory|@bugsnag\/|rollbar|newrelic|@datadog\/)|googletagmanager|google-analytics|clarity\.ms|\bgtag\(|\bsendBeacon\b/i;

const REPO = fileURLToPath(new URL("../../../../", import.meta.url));
const SOURCE_ROOTS = [
	"apps/web/src",
	"apps/web/index.html",
	"apps/web/package.json",
	"apps/api/src",
	"apps/api/package.json",
	"packages",
];
const SKIPPED = new Set(["node_modules", "dist", "generated"]);

/** Source files under `path`, tests left out (this one names the services). */
function sourceFiles(path: string): string[] {
	const full = join(REPO, path);
	if (/\.(tsx?|html|json)$/.test(path)) return [full];
	return readdirSync(full, { withFileTypes: true }).flatMap((entry) => {
		if (SKIPPED.has(entry.name)) return [];
		const child = join(path, entry.name);
		if (entry.isDirectory()) return sourceFiles(child);
		return /\.(tsx?|json)$/.test(entry.name) &&
			!/\.test\.tsx?$/.test(entry.name)
			? [join(REPO, child)]
			: [];
	});
}

describe("the data policy's promise of no telemetry", () => {
	it("holds in the policy, the web app, the API and the shared packages", () => {
		expect(TELEMETRY_SERVICES).toEqual([]);
		const files = SOURCE_ROOTS.flatMap(sourceFiles);
		expect(files.length).toBeGreaterThan(100);
		const found = files.filter((file) =>
			TELEMETRY.test(readFileSync(file, "utf8")),
		);
		expect(found).toEqual([]);
	});
});
