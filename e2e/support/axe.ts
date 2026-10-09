import { createRequire } from "node:module";
import type { Page } from "@playwright/test";

/**
 * axe-core is a devDependency of apps/web: resolved from there, so the E2E
 * package needs no new dependency.
 */
const WEB_REQUIRE = createRequire(
	new URL("../../apps/web/package.json", import.meta.url),
);
const AXE_SCRIPT = WEB_REQUIRE.resolve("axe-core");

export interface AxeFinding {
	readonly id: string;
	readonly impact: string | null;
	readonly nodes: number;
	/** CSS selectors of the first failing nodes, for the failure message. */
	readonly targets: string[];
	/** HTML of the first failing node, cut to 300 characters. */
	readonly html: string;
}

interface AxeRunResult {
	readonly violations: {
		readonly id: string;
		readonly impact?: string | null;
		readonly nodes: readonly {
			readonly target: readonly string[];
			readonly html: string;
		}[];
	}[];
}

interface AxeGlobal {
	run(
		context: Document,
		options: { runOnly: { type: "tag"; values: string[] } },
	): Promise<AxeRunResult>;
}

/** WCAG 2.0 and 2.1 A and AA rules on the page; returns every violation. */
export async function axeViolations(page: Page): Promise<AxeFinding[]> {
	await page.addScriptTag({ path: AXE_SCRIPT });
	return page.evaluate(async () => {
		const axe = (window as unknown as { axe: AxeGlobal }).axe;
		const result = await axe.run(document, {
			runOnly: {
				type: "tag",
				values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
			},
		});
		return result.violations.map((violation) => ({
			id: violation.id,
			impact: violation.impact ?? null,
			nodes: violation.nodes.length,
			targets: violation.nodes.slice(0, 3).map((node) => node.target.join(" ")),
			html: (violation.nodes[0]?.html ?? "").slice(0, 300),
		}));
	});
}
