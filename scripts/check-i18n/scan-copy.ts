/**
 * Finds user-facing text that bypasses the i18n dictionaries: Vietnamese
 * outside `apps/web/src/i18n/messages/vi/`, and competitor names anywhere
 * in the web app. Only string literals, template text and JSX text are
 * read, so comments never count.
 */
import ts from "typescript";

export type CopyRule = "vietnamese" | "competitor";

export interface CopyViolation {
	file: string;
	line: number;
	rule: CopyRule;
	text: string;
}

/**
 * A line containing this marker followed by a non-empty reason is skipped
 * (for example a language named in itself, "Tiếng Việt").
 */
export const IGNORE_MARKER = "check-i18n-ignore:";

/** Letters only Vietnamese uses among the app's languages. */
const VIETNAMESE =
	/[ăâđêôơưàáạảãằắặẳẵầấậẩẫèéẹẻẽềếệểễìíịỉĩòóọỏõồốộổỗờớợởỡùúụủũừứựửữỳýỵỷỹ]/i;

/** Competitors the product does not name (plan: brand cleanup). */
const COMPETITOR = /mockapi|postman/i;

const RULES: ReadonlyArray<readonly [CopyRule, RegExp]> = [
	["vietnamese", VIETNAMESE],
	["competitor", COMPETITOR],
];

/**
 * Tests and test helpers (repo-relative path) may hold any text they need
 * to assert.
 */
export function isTestFile(file: string): boolean {
	return (
		/\.test\.tsx?$/.test(file) ||
		/-test-helpers\.tsx?$/.test(file) ||
		file.startsWith("apps/web/src/test/")
	);
}

function hasIgnoreMarker(line: string): boolean {
	const index = line.indexOf(IGNORE_MARKER);
	if (index === -1) return false;
	return line.slice(index + IGNORE_MARKER.length).trim().length > 0;
}

/** Text nodes of a TS/TSX source: literals, template parts, JSX text. */
function textNodes(
	source: ts.SourceFile,
): Array<{ text: string; line: number }> {
	const found: Array<{ text: string; line: number }> = [];
	const visit = (node: ts.Node): void => {
		if (
			ts.isStringLiteral(node) ||
			ts.isNoSubstitutionTemplateLiteral(node) ||
			ts.isTemplateHead(node) ||
			ts.isTemplateMiddle(node) ||
			ts.isTemplateTail(node) ||
			ts.isJsxText(node)
		) {
			const start = node.getStart(source);
			const { line } = source.getLineAndCharacterOfPosition(start);
			found.push({ text: node.text, line: line + 1 });
		}
		ts.forEachChild(node, visit);
	};
	visit(source);
	return found;
}

/** Violations of a `.ts`/`.tsx` file; `rules` limits which rules apply. */
export function scanScript(
	content: string,
	file: string,
	rules: ReadonlySet<CopyRule>,
): CopyViolation[] {
	const kind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
	const source = ts.createSourceFile(
		file,
		content,
		ts.ScriptTarget.Latest,
		true,
		kind,
	);
	const lines = content.split("\n");
	const violations: CopyViolation[] = [];
	for (const { text, line } of textNodes(source)) {
		if (hasIgnoreMarker(lines[line - 1] ?? "")) continue;
		for (const [rule, pattern] of RULES) {
			if (rules.has(rule) && pattern.test(text)) {
				violations.push({ file, line, rule, text: text.trim() });
			}
		}
	}
	return violations;
}

/** Violations of an HTML file, ignoring `<!-- comments -->`. */
export function scanHtml(content: string, file: string): CopyViolation[] {
	// Comments become blank lines of the same count, so numbers stay right.
	const visible = content.replace(/<!--[\s\S]*?-->/g, (comment) =>
		comment.replace(/[^\n]/g, ""),
	);
	const violations: CopyViolation[] = [];
	visible.split("\n").forEach((text, index) => {
		for (const [rule, pattern] of RULES) {
			if (pattern.test(text)) {
				violations.push({ file, line: index + 1, rule, text: text.trim() });
			}
		}
	});
	return violations;
}
