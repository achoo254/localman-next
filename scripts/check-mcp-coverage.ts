/**
 * CI gate: every operation must expose an MCP tool or carry `mcp.exempt`
 * with a reason. On success it prints the operation → tool table per
 * toolset (markdown). Usage:
 *   pnpm check:mcp-coverage [registry-module] [--markdown <path>]
 * The registry module must export `operations`; it defaults to the API
 * registry and can also be set through MCP_COVERAGE_REGISTRY.
 * `--markdown <path>` also writes the table to that file (docs page).
 * Exit codes: 0 clean, 1 violations, 2 bad arguments or registry could not
 * be loaded.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { PROTOCOL_ROUTES } from "../apps/api/src/operations/protocol-routes.js";
import {
	findMcpCoverageViolations,
	isOperationDefinition,
	renderMcpToolTable,
} from "../packages/operations/src/index.js";

const DEFAULT_REGISTRY = resolve(
	import.meta.dirname,
	"../apps/api/src/operations/registry.ts",
);

interface CliArgs {
	readonly registry: string | undefined;
	readonly markdownPath: string | undefined;
}

function parseArgs(argv: readonly string[]): CliArgs {
	let registry: string | undefined;
	let markdownPath: string | undefined;
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === "--markdown") {
			const value = argv[i + 1];
			if (!value || value.startsWith("--")) {
				throw new Error("--markdown needs a file path");
			}
			markdownPath = resolve(value);
			i++;
		} else if (arg?.startsWith("--")) {
			throw new Error(`unknown option ${arg}`);
		} else if (registry === undefined) {
			registry = arg;
		} else {
			throw new Error(`unexpected argument ${arg}`);
		}
	}
	return { registry, markdownPath };
}

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

function fail(message: string): never {
	console.error(`check:mcp-coverage: ${message}`);
	process.exit(2);
}

let args: CliArgs;
try {
	args = parseArgs(process.argv.slice(2));
} catch (error) {
	fail(error instanceof Error ? error.message : String(error));
}

// Empty values count as unset so `MCP_COVERAGE_REGISTRY=` keeps the default.
const registryPath = resolve(
	args.registry || process.env.MCP_COVERAGE_REGISTRY || DEFAULT_REGISTRY,
);

let operations: readonly unknown[];
try {
	operations = await loadOperations(registryPath);
} catch (error) {
	const reason = error instanceof Error ? error.message : String(error);
	fail(`cannot load ${registryPath}: ${reason}`);
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
// Hand-written protocol routes have no operation and therefore no tool.
console.log(
	`Protocol routes outside the registry (${PROTOCOL_ROUTES.length}):`,
);
for (const route of PROTOCOL_ROUTES) {
	const methods = route.methods.join("|");
	console.log(
		`  - [${route.server}] ${methods} ${route.path}: ${route.mcpExempt}`,
	);
}

const definitions = operations.filter(isOperationDefinition);
if (definitions.length !== operations.length) {
	fail("registry has entries not built with defineOperation");
}
const table = renderMcpToolTable(definitions);
console.log("");
console.log(table);

if (args.markdownPath) {
	try {
		await mkdir(dirname(args.markdownPath), { recursive: true });
		await writeFile(args.markdownPath, `${table}\n`, "utf8");
	} catch (error) {
		const reason = error instanceof Error ? error.message : String(error);
		fail(`cannot write ${args.markdownPath}: ${reason}`);
	}
	console.log(`MCP tool table written to ${args.markdownPath}`);
}
