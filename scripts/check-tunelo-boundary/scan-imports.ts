import path from "node:path";

/** One Tunelo package and the Localman packages it may import. */
export interface TuneloPackage {
	/** Repo-relative root, e.g. `apps/tunelo-server`. */
	root: string;
	allowedLocalman: readonly string[];
}

/**
 * Tunelo ships on its own (the `tunelo` CLI on npm, the server on the edge
 * box), so it must not grow into Localman. The server shares only the
 * tenancy guard (`@localman/tenancy`); the CLI and the protocol package share
 * nothing. See `docs/tunelo/system-architecture.md`, "Boundary with Localman".
 */
export const TUNELO_PACKAGES: readonly TuneloPackage[] = [
	{ root: "apps/tunelo-server", allowedLocalman: ["@localman/tenancy"] },
	{ root: "packages/tunelo-cli", allowedLocalman: [] },
	{ root: "packages/tunelo-shared", allowedLocalman: [] },
];

export interface BoundaryViolation {
	file: string;
	line: number;
	specifier: string;
	reason: string;
}

const IMPORT_PATTERNS = [
	/\b(?:import|export)\s[^;]*?\bfrom\s*["']([^"']+)["']/g,
	/\bimport\s*["']([^"']+)["']/g,
	/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
	/\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
];

function lineOf(content: string, index: number): number {
	return content.slice(0, index).split("\n").length;
}

/** Every module specifier in a source file, with the line it starts on. */
export function findSpecifiers(
	content: string,
): { specifier: string; line: number }[] {
	const found: { specifier: string; line: number; index: number }[] = [];
	for (const pattern of IMPORT_PATTERNS) {
		for (const match of content.matchAll(pattern)) {
			const specifier = match[1];
			if (specifier === undefined) continue;
			const index = match.index + match[0].lastIndexOf(specifier);
			found.push({ specifier, line: lineOf(content, index), index });
		}
	}
	return found
		.sort((a, b) => a.index - b.index)
		.map(({ specifier, line }) => ({ specifier, line }));
}

function localmanPackage(specifier: string): string | undefined {
	const match = /^(@localman\/[^/]+)/.exec(specifier);
	return match?.[1];
}

/**
 * Violations in one file of `pkg`: a Localman package outside its allow list,
 * or a relative import that leaves the package root.
 */
export function checkFile(
	file: string,
	content: string,
	pkg: TuneloPackage,
): BoundaryViolation[] {
	const violations: BoundaryViolation[] = [];
	for (const { specifier, line } of findSpecifiers(content)) {
		const localman = localmanPackage(specifier);
		if (localman !== undefined && !pkg.allowedLocalman.includes(localman)) {
			violations.push({
				file,
				line,
				specifier,
				reason: `${pkg.root} may not import ${localman}`,
			});
			continue;
		}
		if (specifier.startsWith(".")) {
			const target = path.posix.join(path.posix.dirname(file), specifier);
			if (!target.startsWith(`${pkg.root}/`)) {
				violations.push({
					file,
					line,
					specifier,
					reason: `relative import leaves ${pkg.root}`,
				});
			}
		}
	}
	return violations;
}
