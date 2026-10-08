/**
 * CI gate: every operation must expose an MCP tool or carry `mcp.exempt`
 * with a reason. Usage:
 *   pnpm check:mcp-coverage [registry-module]
 * The registry module must export `operations`; it defaults to the API
 * registry and can also be set through MCP_COVERAGE_REGISTRY.
 * Exit codes: 0 clean, 1 violations, 2 registry could not be loaded.
 */
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { findMcpCoverageViolations } from "../packages/operations/src/index.js";

const DEFAULT_REGISTRY = resolve(
	import.meta.dirname,
	"../apps/api/src/operations/registry.ts",
);

// Empty values count as unset so `MCP_COVERAGE_REGISTRY=` keeps the default.
const registryPath = resolve(
	process.argv[2] || process.env.MCP_COVERAGE_REGISTRY || DEFAULT_REGISTRY,
);

async function loadOperations(path: string): Promise<readonly unknown[]> {
	const registry: unknown = await import(pathToFileURL(path).href);
	const operations =
		typeof registry === "object" &&
		registry !== null &&
		"operations" in registry
			? registry.operations
			: undefined;
	if (!Array.isArray(operations)) {
		throw new Error("module does not export an `operations` array");
	}
	return operations;
}

function isToolDeclared(op: unknown): boolean {
	return (
		typeof op === "object" && op !== null && "mcp" in op && op.mcp === true
	);
}

let operations: readonly unknown[];
try {
	operations = await loadOperations(registryPath);
} catch (error) {
	const reason = error instanceof Error ? error.message : String(error);
	console.error(`check:mcp-coverage: cannot load ${registryPath}: ${reason}`);
	process.exit(2);
}

const violations = findMcpCoverageViolations(operations);
if (violations.length > 0) {
	console.error(`MCP coverage failed for ${registryPath}:`);
	for (const v of violations) {
		console.error(`  - [${v.code}] ${v.operationId}: ${v.message}`);
	}
	console.error(`${violations.length} violation(s).`);
	process.exit(1);
}

const tools = operations.filter(isToolDeclared).length;
console.log(
	`MCP coverage OK: ${operations.length} operation(s), ${tools} tool(s), ${operations.length - tools} exempt.`,
);
