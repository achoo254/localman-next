import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PROTOCOL_ROUTES } from "./protocol-routes.js";

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

	it("lists the hand-written protocol routes, MCP endpoints included", () => {
		const result = runCoverage();
		expect(result.status).toBe(0);
		expect(result.stdout).toContain(
			`Protocol routes outside the registry (${PROTOCOL_ROUTES.length}):`,
		);
		for (const route of PROTOCOL_ROUTES) {
			expect(result.stdout).toContain(
				`  - [${route.server}] ${route.methods.join("|")} ${route.path}: ${route.mcpExempt}`,
			);
		}
		expect(result.stdout).toContain("[dashboard] ALL /mcp:");
		expect(result.stdout).toContain(
			"[dashboard] GET|OPTIONS /.well-known/oauth-protected-resource/mcp:",
		);
		expect(result.stdout).toContain("[mock] ALL /m/{secret}/{prefix}/mcp:");
	});

	it("prints the tool table per toolset and writes it with --markdown", async () => {
		const dir = await mkdtemp(join(tmpdir(), "mcp-coverage-"));
		try {
			const target = join(dir, "docs", "mcp-tools.md");
			const result = runCoverage("--markdown", target);
			expect(result.stderr).toBe("");
			expect(result.status).toBe(0);
			expect(result.stdout).toContain("## Toolset `mock`");
			expect(result.stdout).toContain(
				"| `list_projects` | `mock.listProjects` |",
			);
			// Members and invitations are their own toolset, outside OAuth.
			expect(result.stdout).toContain("## Toolset `collab`");
			expect(result.stdout).toContain(
				"| `invite_collaborator` | `collab.inviteCollaborator` |",
			);
			const written = await readFile(target, "utf8");
			expect(written).toMatch(/^# MCP tools\n/);
			expect(written).toContain("`dry_run` then `confirm_token`");
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("rejects --markdown without a path", () => {
		const result = runCoverage("--markdown");
		expect(result.status).toBe(2);
		expect(result.stderr).toContain("--markdown needs a file path");
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
