import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../../../..");
const script = resolve(repoRoot, "scripts/check-mcp-coverage.ts");

function runCoverage(...args: string[]) {
	const { MCP_COVERAGE_REGISTRY: _ignored, ...env } = process.env;
	return spawnSync(process.execPath, ["--import", "tsx", script, ...args], {
		cwd: repoRoot,
		encoding: "utf8",
		env,
	});
}

describe("check:mcp-coverage script", () => {
	it("passes for the real API registry", () => {
		const result = runCoverage();
		expect(result.stderr).toBe("");
		expect(result.status).toBe(0);
		expect(result.stdout).toMatch(/MCP coverage OK: \d+ operation\(s\)/);
	});

	it("fails with exit code 1 when an operation lacks MCP", () => {
		const fixture = resolve(
			import.meta.dirname,
			"__fixtures__/registry-missing-mcp.ts",
		);
		const result = runCoverage(fixture);
		expect(result.status).toBe(1);
		expect(result.stderr).toContain("[MISSING_MCP] mock.listUsers");
	});

	it("exits with 2 when the registry cannot be loaded", () => {
		const result = runCoverage(resolve(repoRoot, "does-not-exist.ts"));
		expect(result.status).toBe(2);
		expect(result.stderr).toContain("cannot load");
	});
});
