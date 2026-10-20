/**
 * Finds the product name hard-coded in code: the configured appName as a
 * whole string literal ("Localman", 'Localman', `Localman`). Sentences that
 * mention the product (descriptions, i18n copy) and identifiers such as
 * the X-Localman-* headers are not product-name literals and pass.
 */

export interface BrandViolation {
	file: string;
	line: number;
}

/**
 * A line containing this marker followed by a non-empty reason is skipped.
 * The reason is mandatory so every exception documents itself.
 */
export const IGNORE_MARKER = "check-brand-ignore:";

/** Test sources may use the product name as fixture data. */
const TEST_FILE =
	/(\.test\.[cm]?[jt]sx?$|\/__tests__\/|\/testing\/|\/test-support\/)/;

export const CODE_FILE = /\.(ts|tsx|js|mjs|cjs)$/;

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasIgnoreMarker(line: string): boolean {
	const index = line.indexOf(IGNORE_MARKER);
	return index !== -1 && line.slice(index + IGNORE_MARKER.length).trim() !== "";
}

/** Whether `file` (repository-relative, `/`-separated) is checked at all. */
export function isScanned(file: string): boolean {
	return CODE_FILE.test(file) && !TEST_FILE.test(file);
}

export function findBrandLiterals(
	source: string,
	file: string,
	appName: string,
): BrandViolation[] {
	if (!isScanned(file)) return [];
	const literal = new RegExp(`(["'\`])${escapeRegExp(appName)}\\1`);
	const violations: BrandViolation[] = [];
	source.split("\n").forEach((text, index) => {
		if (literal.test(text) && !hasIgnoreMarker(text)) {
			violations.push({ file, line: index + 1 });
		}
	});
	return violations;
}
